import torch
from TTS.api import TTS
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class XTTSModel:
    def __init__(self):
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")

    def load_model(self):
        """Load XTTS-v2 model"""
        try:
            logger.info("Loading XTTS-v2 model...")
            self.model = TTS(
                model_name="tts_models/multilingual/multi-dataset/xtts_v2",
                gpu=(self.device == "cuda")
            )
            logger.info("XTTS-v2 model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load XTTS-v2 model: {e}")
            raise

    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None

    def synthesize(
        self,
        text: str,
        speaker_wav: str,
        language: str = "en",
        output_path: str = "output.wav",
        speed: float = 1.0
    ):
        """
        Synthesize speech from text using a speaker reference

        Args:
            text: Text to synthesize
            speaker_wav: Path to speaker reference WAV file
            language: Language code (en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh-cn, ja, ko, hu)
            output_path: Output file path
            speed: Speech speed multiplier
        """
        if not self.is_loaded():
            raise RuntimeError("Model not loaded")

        try:
            # Verify speaker wav exists
            if not Path(speaker_wav).exists():
                raise FileNotFoundError(f"Speaker WAV not found: {speaker_wav}")

            logger.info(f"Synthesizing: '{text[:50]}...' in {language}")

            # Generate speech
            self.model.tts_to_file(
                text=text,
                speaker_wav=speaker_wav,
                language=language,
                file_path=output_path,
                speed=speed
            )

            logger.info(f"Speech synthesized successfully: {output_path}")

        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            raise

    def get_supported_languages(self) -> list:
        """Get list of supported languages"""
        return [
            "en", "es", "fr", "de", "it", "pt", "pl",
            "tr", "ru", "nl", "cs", "ar", "zh-cn", "ja", "ko", "hu"
        ]
