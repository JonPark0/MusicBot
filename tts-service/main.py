from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import uvicorn
import os
import logging
import asyncio
import time
from pathlib import Path

from models.xtts import XTTSModel
from utils.audio_processing import AudioProcessor
from utils.text_chunker import split_text_into_chunks, get_char_limit

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize services (will be loaded in lifespan)
tts_model = XTTSModel()
audio_processor = AudioProcessor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events"""
    # Startup
    logger.info("Starting TTS service...")
    tts_model.load_model()
    logger.info("TTS service ready")

    # Start cache cleanup task
    cleanup_task = asyncio.create_task(cleanup_cache_periodically())

    yield

    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("TTS service shutdown complete")


# Initialize FastAPI app
app = FastAPI(title="TTS Service", version="2.0.0", lifespan=lifespan)

# CORS middleware - restrict to internal network only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://discord-bot:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# Directories
VOICES_DIR = Path("/app/voices")
CACHE_DIR = Path("/app/cache")
VOICES_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Supported languages configuration
# All languages supported by XTTS-v2
ALL_XTTS_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko"]

# Get enabled languages from environment (defaults to all)
_env_languages = os.getenv("TTS_SUPPORTED_LANGUAGES", ",".join(ALL_XTTS_LANGUAGES))
SUPPORTED_LANGUAGES = [lang.strip() for lang in _env_languages.split(",") if lang.strip() in ALL_XTTS_LANGUAGES]

# Ensure at least English is supported
if not SUPPORTED_LANGUAGES:
    SUPPORTED_LANGUAGES = ["en"]

logger.info(f"TTS supported languages: {SUPPORTED_LANGUAGES}")


class SynthesizeRequest(BaseModel):
    text: str
    user_id: str
    voice_name: Optional[str] = None
    language: str = "en"
    speed: float = 1.0


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "TTS Service"}


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "model_loaded": tts_model.is_loaded(),
        "supported_languages": SUPPORTED_LANGUAGES,
    }


@app.get("/languages")
async def get_languages():
    """Get list of supported languages"""
    return {
        "supported": SUPPORTED_LANGUAGES,
        "all_available": ALL_XTTS_LANGUAGES,
    }


@app.post("/register-voice")
async def register_voice(
    user_id: str = Form(...),
    voice_name: str = Form(...),
    language: str = Form("en"),
    audio_file: UploadFile = File(...)
):
    """
    Register a new voice for a user
    """
    try:
        # Validate audio file
        if not audio_file.filename.endswith(('.wav', '.mp3', '.ogg', '.flac')):
            raise HTTPException(
                status_code=400,
                detail="Invalid audio format. Supported: wav, mp3, ogg, flac"
            )

        # Create user directory
        user_dir = VOICES_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)

        # Save original file
        original_path = user_dir / f"{voice_name}_original{Path(audio_file.filename).suffix}"
        with open(original_path, "wb") as f:
            content = await audio_file.read()
            f.write(content)

        # Process audio (convert to WAV, normalize, etc.)
        processed_path = user_dir / f"{voice_name}.wav"
        audio_processor.process_voice_sample(str(original_path), str(processed_path))

        # Validate audio length (should be 6-10 seconds for XTTS)
        duration = audio_processor.get_duration(str(processed_path))
        if duration < 6 or duration > 12:
            os.remove(original_path)
            os.remove(processed_path)
            raise HTTPException(
                status_code=400,
                detail=f"Audio duration must be between 6-12 seconds (got {duration:.1f}s)"
            )

        logger.info(f"Voice registered: user_id={user_id}, voice_name={voice_name}")

        return {
            "status": "success",
            "user_id": user_id,
            "voice_name": voice_name,
            "duration": duration,
            "file_path": str(processed_path)
        }

    except Exception as e:
        logger.error(f"Error registering voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/synthesize")
async def synthesize_speech(request: SynthesizeRequest):
    """
    Synthesize speech from text using user's voice.
    Automatically splits long text into chunks and concatenates audio.
    """
    try:
        # Validate text length (increased limit since we now support chunking)
        if len(request.text) > 2000:
            raise HTTPException(
                status_code=400,
                detail="Text too long (max 2000 characters)"
            )

        if len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        # Validate language
        if request.language not in SUPPORTED_LANGUAGES:
            raise HTTPException(
                status_code=400,
                detail=f"Language '{request.language}' is not supported. Supported languages: {', '.join(SUPPORTED_LANGUAGES)}"
            )

        # Get voice file
        voice_name = request.voice_name or "default"
        voice_path = VOICES_DIR / request.user_id / f"{voice_name}.wav"

        if not voice_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Voice '{voice_name}' not found for user {request.user_id}"
            )

        # Generate unique filename for final output
        import hashlib
        text_hash = hashlib.md5(
            f"{request.user_id}{voice_name}{request.text}{request.speed}".encode()
        ).hexdigest()
        output_path = CACHE_DIR / f"{text_hash}.wav"

        # Check cache
        if output_path.exists():
            logger.info(f"Returning cached TTS: {text_hash}")
            return FileResponse(
                output_path,
                media_type="audio/wav",
                filename="tts_output.wav"
            )

        # Split text into chunks if needed
        text_chunks = split_text_into_chunks(request.text, request.language)

        logger.info(f"Synthesizing speech for user {request.user_id} ({len(text_chunks)} chunk(s))")

        if len(text_chunks) == 1:
            # Single chunk - synthesize directly
            tts_model.synthesize(
                text=text_chunks[0],
                speaker_wav=str(voice_path),
                language=request.language,
                output_path=str(output_path),
                speed=request.speed
            )
        else:
            # Multiple chunks - synthesize each and concatenate
            chunk_paths = []
            try:
                for i, chunk in enumerate(text_chunks):
                    chunk_hash = hashlib.md5(
                        f"{text_hash}_chunk_{i}".encode()
                    ).hexdigest()
                    chunk_path = CACHE_DIR / f"{chunk_hash}_temp.wav"

                    logger.info(f"Synthesizing chunk {i+1}/{len(text_chunks)}: '{chunk[:30]}...'")

                    tts_model.synthesize(
                        text=chunk,
                        speaker_wav=str(voice_path),
                        language=request.language,
                        output_path=str(chunk_path),
                        speed=request.speed
                    )
                    chunk_paths.append(str(chunk_path))

                # Concatenate all chunks
                logger.info(f"Concatenating {len(chunk_paths)} audio chunks")
                audio_processor.concatenate_audio_files(chunk_paths, str(output_path))

            finally:
                # Clean up temporary chunk files
                for chunk_path in chunk_paths:
                    try:
                        if os.path.exists(chunk_path):
                            os.remove(chunk_path)
                    except Exception as e:
                        logger.warning(f"Failed to remove temp file {chunk_path}: {e}")

        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="tts_output.wav"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error synthesizing speech: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/voices/{user_id}")
async def list_voices(user_id: str):
    """
    List all voices for a user
    """
    try:
        user_dir = VOICES_DIR / user_id

        if not user_dir.exists():
            return {"voices": []}

        voices = []
        for file in user_dir.glob("*.wav"):
            if not file.name.endswith("_original.wav"):
                duration = audio_processor.get_duration(str(file))
                voices.append({
                    "name": file.stem,
                    "duration": duration,
                    "file_path": str(file)
                })

        return {"voices": voices}

    except Exception as e:
        logger.error(f"Error listing voices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/voices/{user_id}/{voice_name}")
async def delete_voice(user_id: str, voice_name: str):
    """
    Delete a voice
    """
    try:
        user_dir = VOICES_DIR / user_id
        voice_path = user_dir / f"{voice_name}.wav"
        original_path = user_dir / f"{voice_name}_original.wav"

        if voice_path.exists():
            os.remove(voice_path)
        if original_path.exists():
            os.remove(original_path)

        logger.info(f"Voice deleted: user_id={user_id}, voice_name={voice_name}")

        return {"status": "success", "message": "Voice deleted"}

    except Exception as e:
        logger.error(f"Error deleting voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def cleanup_cache_periodically():
    """
    Periodically clean up old cache files
    """
    max_cache_size_gb = float(os.getenv("MAX_CACHE_SIZE_GB", "10"))
    cleanup_hours = int(os.getenv("CACHE_CLEANUP_HOURS", "24"))
    cleanup_interval = cleanup_hours * 3600  # Convert to seconds
    max_cache_bytes = max_cache_size_gb * 1024 * 1024 * 1024

    while True:
        try:
            await asyncio.sleep(cleanup_interval)

            logger.info("Starting cache cleanup...")

            # Get all cache files with their stats
            cache_files = []
            total_size = 0

            for file_path in CACHE_DIR.glob("*.wav"):
                stat = file_path.stat()
                cache_files.append({
                    "path": file_path,
                    "size": stat.st_size,
                    "atime": stat.st_atime  # Last access time
                })
                total_size += stat.st_size

            # Sort by access time (oldest first)
            cache_files.sort(key=lambda x: x["atime"])

            # Remove old files if cache is too large
            files_removed = 0
            bytes_freed = 0

            for file_info in cache_files:
                if total_size <= max_cache_bytes:
                    break

                try:
                    os.remove(file_info["path"])
                    total_size -= file_info["size"]
                    bytes_freed += file_info["size"]
                    files_removed += 1
                except Exception as e:
                    logger.error(f"Failed to remove cache file {file_info['path']}: {e}")

            if files_removed > 0:
                logger.info(
                    f"Cache cleanup completed: removed {files_removed} files, "
                    f"freed {bytes_freed / (1024*1024):.2f} MB"
                )
            else:
                logger.info("Cache cleanup completed: no files removed")

        except Exception as e:
            logger.error(f"Error in cache cleanup: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
