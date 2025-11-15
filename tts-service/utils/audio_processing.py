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
