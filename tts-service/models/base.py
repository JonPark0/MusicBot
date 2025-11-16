"""
Base interface for TTS models
"""
from abc import ABC, abstractmethod
from typing import List


class BaseTTSModel(ABC):
    """Abstract base class for TTS models"""

    @abstractmethod
    def load_model(self):
        """Load the model into memory"""
        pass

    @abstractmethod
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        pass

    @abstractmethod
    def synthesize(
        self,
        text: str,
        speaker_wav: str,
        language: str = "en",
        output_path: str = "output.wav",
        speed: float = 1.0,
        **kwargs
    ):
        """
        Synthesize speech from text using a speaker reference

        Args:
            text: Text to synthesize
            speaker_wav: Path to speaker reference WAV file
            language: Language code
            output_path: Output file path
            speed: Speech speed multiplier (interpretation may vary by model)
            **kwargs: Model-specific parameters
        """
        pass

    @abstractmethod
    def get_supported_languages(self) -> List[str]:
        """Get list of supported language codes"""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model's identifier name"""
        pass

    def get_model_info(self) -> dict:
        """Get model information"""
        return {
            "name": self.get_model_name(),
            "loaded": self.is_loaded(),
            "supported_languages": self.get_supported_languages()
        }
