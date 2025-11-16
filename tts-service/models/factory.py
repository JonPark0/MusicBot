"""
TTS Model Factory
Manages loading and selection of different TTS models
"""
import logging
from typing import Dict, Optional
from .base import BaseTTSModel
from .xtts import XTTSModel

logger = logging.getLogger(__name__)


class TTSModelFactory:
    """Factory for managing multiple TTS models"""

    # Registry of available models
    AVAILABLE_MODELS = {
        "xtts-v2": XTTSModel,
    }

    def __init__(self):
        self.models: Dict[str, BaseTTSModel] = {}
        self.default_model: str = "xtts-v2"

    def load_model(self, model_name: str) -> BaseTTSModel:
        """
        Load a specific model

        Args:
            model_name: Name of the model to load

        Returns:
            Loaded model instance
        """
        if model_name not in self.AVAILABLE_MODELS:
            raise ValueError(
                f"Unknown model: {model_name}. "
                f"Available: {list(self.AVAILABLE_MODELS.keys())}"
            )

        if model_name not in self.models:
            logger.info(f"Loading model: {model_name}")
            model_class = self.AVAILABLE_MODELS[model_name]
            model = model_class()
            model.load_model()
            self.models[model_name] = model
            logger.info(f"Model {model_name} loaded successfully")
        else:
            logger.info(f"Model {model_name} already loaded")

        return self.models[model_name]

    def get_model(self, model_name: Optional[str] = None) -> BaseTTSModel:
        """
        Get a loaded model by name

        Args:
            model_name: Name of the model, or None for default

        Returns:
            Model instance
        """
        if model_name is None:
            model_name = self.default_model

        if model_name not in self.models:
            raise RuntimeError(
                f"Model {model_name} not loaded. "
                f"Loaded models: {list(self.models.keys())}"
            )

        return self.models[model_name]

    def is_model_loaded(self, model_name: str) -> bool:
        """Check if a specific model is loaded"""
        return model_name in self.models and self.models[model_name].is_loaded()

    def get_loaded_models(self) -> list:
        """Get list of loaded model names"""
        return list(self.models.keys())

    def get_available_models(self) -> list:
        """Get list of all available model names"""
        return list(self.AVAILABLE_MODELS.keys())

    def set_default_model(self, model_name: str):
        """Set the default model"""
        if model_name not in self.AVAILABLE_MODELS:
            raise ValueError(f"Unknown model: {model_name}")
        self.default_model = model_name
        logger.info(f"Default model set to: {model_name}")

    def get_all_models_info(self) -> dict:
        """Get information about all models"""
        info = {
            "available": self.get_available_models(),
            "loaded": self.get_loaded_models(),
            "default": self.default_model,
            "models": {}
        }

        for model_name, model in self.models.items():
            info["models"][model_name] = model.get_model_info()

        return info
