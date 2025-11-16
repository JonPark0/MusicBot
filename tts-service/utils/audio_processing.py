import subprocess
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class AudioProcessor:
    def __init__(self, target_sr: int = 22050):
        self.target_sr = target_sr

    def process_voice_sample(self, input_path: str, output_path: str):
        """
        Process audio file: convert to WAV, normalize, resample
        """
        try:
            logger.info(f"Processing audio: {input_path}")

            # Load audio
            audio, sr = librosa.load(input_path, sr=self.target_sr, mono=True)

            # Normalize audio
            audio = self.normalize_audio(audio)

            # Remove silence from beginning and end
            audio = self.trim_silence(audio, sr)

            # Save as WAV
            sf.write(output_path, audio, sr, subtype='PCM_16')

            logger.info(f"Audio processed successfully: {output_path}")

        except Exception as e:
            logger.error(f"Audio processing failed: {e}")
            raise

    def normalize_audio(self, audio: np.ndarray, target_db: float = -20.0) -> np.ndarray:
        """
        Normalize audio to target dB
        """
        # Calculate current RMS
        rms = np.sqrt(np.mean(audio**2))

        if rms == 0:
            return audio

        # Calculate target RMS
        target_rms = 10 ** (target_db / 20)

        # Normalize
        normalized = audio * (target_rms / rms)

        # Prevent clipping
        max_val = np.abs(normalized).max()
        if max_val > 1.0:
            normalized = normalized / max_val * 0.95

        return normalized

    def trim_silence(
        self,
        audio: np.ndarray,
        sr: int,
        top_db: int = 30,
        frame_length: int = 2048,
        hop_length: int = 512
    ) -> np.ndarray:
        """
        Trim silence from beginning and end of audio
        """
        trimmed, _ = librosa.effects.trim(
            audio,
            top_db=top_db,
            frame_length=frame_length,
            hop_length=hop_length
        )
        return trimmed

    def get_duration(self, audio_path: str) -> float:
        """
        Get duration of audio file in seconds
        """
        try:
            audio, sr = librosa.load(audio_path, sr=None)
            duration = librosa.get_duration(y=audio, sr=sr)
            return duration
        except Exception as e:
            logger.error(f"Failed to get audio duration: {e}")
            return 0.0

    def convert_to_wav(self, input_path: str, output_path: str):
        """
        Convert audio file to WAV using FFmpeg
        """
        try:
            cmd = [
                'ffmpeg',
                '-i', input_path,
                '-ar', str(self.target_sr),
                '-ac', '1',
                '-y',
                output_path
            ]

            subprocess.run(
                cmd,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            logger.info(f"Converted to WAV: {output_path}")

        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg conversion failed: {e}")
            raise

    def resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """
        Resample audio to target sample rate
        """
        if orig_sr == target_sr:
            return audio

        return librosa.resample(audio, orig_sr=orig_sr, target_sr=target_sr)

    def concatenate_audio_files(self, audio_paths: list[str], output_path: str, silence_ms: int = 100):
        """
        Concatenate multiple audio files with optional silence between them.

        Args:
            audio_paths: List of paths to audio files to concatenate
            output_path: Path to save the concatenated audio
            silence_ms: Milliseconds of silence to add between chunks
        """
        if not audio_paths:
            raise ValueError("No audio files to concatenate")

        if len(audio_paths) == 1:
            # Just copy the single file
            import shutil
            shutil.copy(audio_paths[0], output_path)
            return

        try:
            logger.info(f"Concatenating {len(audio_paths)} audio files")

            # Load all audio files
            audio_segments = []
            sample_rate = None

            for audio_path in audio_paths:
                audio, sr = librosa.load(audio_path, sr=self.target_sr, mono=True)
                audio_segments.append(audio)

                if sample_rate is None:
                    sample_rate = sr
                elif sr != sample_rate:
                    # Resample if needed
                    audio = self.resample(audio, sr, sample_rate)

            # Create silence
            silence_samples = int((silence_ms / 1000) * sample_rate)
            silence = np.zeros(silence_samples, dtype=np.float32)

            # Concatenate with silence between segments
            concatenated = []
            for i, segment in enumerate(audio_segments):
                concatenated.append(segment)
                if i < len(audio_segments) - 1:  # Don't add silence after last segment
                    concatenated.append(silence)

            # Combine all segments
            final_audio = np.concatenate(concatenated)

            # Normalize the final audio
            final_audio = self.normalize_audio(final_audio)

            # Save
            sf.write(output_path, final_audio, sample_rate, subtype='PCM_16')

            logger.info(f"Audio concatenated successfully: {output_path}")

        except Exception as e:
            logger.error(f"Audio concatenation failed: {e}")
            raise
