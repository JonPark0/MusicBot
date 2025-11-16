import torch
import torchaudio as ta
import logging
from pathlib import Path
from .base import BaseTTSModel

logger = logging.getLogger(__name__)


class ChatterboxModel(BaseTTSModel):
    """
    Chatterbox TTS model wrapper
    Supports multilingual zero-shot voice cloning with emotion control
    """

    def __init__(self):
        self.model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.sample_rate = None
        logger.info(f"Chatterbox using device: {self.device}")

    def load_model(self):
        """Load Chatterbox multilingual model"""
        try:
            logger.info("Loading Chatterbox multilingual model...")
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS

            self.model = ChatterboxMultilingualTTS.from_pretrained(device=self.device)
            self.sample_rate = self.model.sr
            logger.info(f"Chatterbox model loaded successfully (sr={self.sample_rate})")
        except ImportError as e:
            logger.error(f"Chatterbox package not installed: {e}")
            raise ImportError(
                "chatterbox-tts package not installed. "
                "Install with: pip install chatterbox-tts"
            )
        except Exception as e:
            logger.error(f"Failed to load Chatterbox model: {e}")
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
        speed: float = 1.0,
        **kwargs
    ):
        """
        Synthesize speech from text using a speaker reference

        Args:
            text: Text to synthesize
            speaker_wav: Path to speaker reference WAV file
            language: Language code (23 languages supported)
            output_path: Output file path
            speed: Speech speed (mapped to cfg_weight: lower = slower)
            **kwargs:
                exaggeration: Emotion intensity (0.0-1.0+, default 0.5)
                cfg_weight: Override direct cfg_weight (0.0-1.0)
        """
        if not self.is_loaded():
            raise RuntimeError("Model not loaded")

        try:
            # Verify speaker wav exists
            if not Path(speaker_wav).exists():
                raise FileNotFoundError(f"Speaker WAV not found: {speaker_wav}")

            # Map language codes to Chatterbox format
            lang_code = self._map_language_code(language)

            logger.info(f"Synthesizing with Chatterbox: '{text[:50]}...' in {lang_code}")

            # Map speed to cfg_weight
            # speed 1.0 -> cfg_weight 0.5 (default)
            # speed 0.5 -> cfg_weight 0.3 (slower)
            # speed 2.0 -> cfg_weight 0.7 (faster)
            if "cfg_weight" in kwargs:
                cfg_weight = kwargs["cfg_weight"]
            else:
                # Map speed (0.5-2.0) to cfg_weight (0.3-0.7)
                cfg_weight = 0.3 + (speed - 0.5) * (0.4 / 1.5)
                cfg_weight = max(0.1, min(0.9, cfg_weight))

            exaggeration = kwargs.get("exaggeration", 0.5)

            logger.debug(f"Chatterbox params: cfg_weight={cfg_weight}, exaggeration={exaggeration}")

            # Generate speech
            wav = self.model.generate(
                text,
                language_id=lang_code,
                audio_prompt_path=speaker_wav,
                exaggeration=exaggeration,
                cfg_weight=cfg_weight
            )

            # Save output
            ta.save(output_path, wav, self.sample_rate)

            logger.info(f"Speech synthesized successfully: {output_path}")

        except Exception as e:
            logger.error(f"Synthesis failed: {e}")
            raise

    def _map_language_code(self, language: str) -> str:
        """
        Map language codes to Chatterbox format

        Chatterbox uses 2-letter codes: ar, da, de, el, en, es, fi, fr, he, hi,
        it, ja, ko, ms, nl, no, pl, pt, ru, sv, sw, tr, zh
        """
        # Map common variations
        mapping = {
            "zh-cn": "zh",
            "zh-tw": "zh",
            "ja": "ja",
            "ko": "ko",
            "en": "en",
            "es": "es",
            "fr": "fr",
            "de": "de",
            "it": "it",
            "pt": "pt",
            "pl": "pl",
            "tr": "tr",
            "ru": "ru",
            "nl": "nl",
            "ar": "ar",
            "da": "da",
            "el": "el",
            "fi": "fi",
            "he": "he",
            "hi": "hi",
            "ms": "ms",
            "no": "no",
            "sv": "sv",
            "sw": "sw",
        }

        return mapping.get(language, language)

    def get_supported_languages(self) -> list:
        """
        Get list of supported languages (23 languages)
        """
        return [
            "ar",  # Arabic
            "da",  # Danish
            "de",  # German
            "el",  # Greek
            "en",  # English
            "es",  # Spanish
            "fi",  # Finnish
            "fr",  # French
            "he",  # Hebrew
            "hi",  # Hindi
            "it",  # Italian
            "ja",  # Japanese
            "ko",  # Korean
            "ms",  # Malay
            "nl",  # Dutch
            "no",  # Norwegian
            "pl",  # Polish
            "pt",  # Portuguese
            "ru",  # Russian
            "sv",  # Swedish
            "sw",  # Swahili
            "tr",  # Turkish
            "zh",  # Chinese (mapped from zh-cn)
        ]

    def get_model_name(self) -> str:
        """Get the model's identifier name"""
        return "chatterbox"
