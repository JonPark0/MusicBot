"""
Text chunking utility for XTTS-v2 model
Handles language-specific character limits to prevent audio truncation
"""
import re
import logging

logger = logging.getLogger(__name__)

# XTTS-v2 character limits per language (conservative estimates)
LANGUAGE_CHAR_LIMITS = {
    "ko": 90,      # Korean
    "ja": 90,      # Japanese
    "zh-cn": 80,   # Chinese
    "ar": 150,     # Arabic
    "en": 240,     # English
    "es": 230,     # Spanish
    "fr": 230,     # French
    "de": 220,     # German
    "it": 230,     # Italian
    "pt": 230,     # Portuguese
    "pl": 220,     # Polish
    "tr": 220,     # Turkish
    "ru": 200,     # Russian
    "nl": 230,     # Dutch
    "cs": 220,     # Czech
    "hu": 220,     # Hungarian
}

# Default limit for unknown languages
DEFAULT_CHAR_LIMIT = 200


def get_char_limit(language: str) -> int:
    """Get character limit for a specific language"""
    return LANGUAGE_CHAR_LIMITS.get(language, DEFAULT_CHAR_LIMIT)


def split_text_into_chunks(text: str, language: str = "en") -> list[str]:
    """
    Split text into chunks that respect the language-specific character limit.
    Tries to split at natural boundaries (sentences, commas, spaces).

    Args:
        text: Text to split
        language: Language code

    Returns:
        List of text chunks
    """
    char_limit = get_char_limit(language)

    # If text is already within limit, return as is
    if len(text) <= char_limit:
        return [text]

    chunks = []
    remaining_text = text.strip()

    while remaining_text:
        if len(remaining_text) <= char_limit:
            chunks.append(remaining_text)
            break

        # Find the best split point within the limit
        chunk = remaining_text[:char_limit]
        split_point = find_best_split_point(chunk, language)

        if split_point > 0:
            chunks.append(remaining_text[:split_point].strip())
            remaining_text = remaining_text[split_point:].strip()
        else:
            # Force split at limit if no good split point found
            chunks.append(chunk.strip())
            remaining_text = remaining_text[char_limit:].strip()

    logger.info(f"Split text into {len(chunks)} chunks for language '{language}'")
    return chunks


def find_best_split_point(text: str, language: str) -> int:
    """
    Find the best point to split text, preferring natural boundaries.

    Priority:
    1. Sentence endings (., !, ?, 。, ！, ？)
    2. Clause boundaries (;, :, 、)
    3. Comma (,, ，)
    4. Space (for space-separated languages)
    5. Any character (last resort)
    """
    # Sentence ending patterns based on language
    if language in ["ko", "ja", "zh-cn"]:
        # CJK sentence endings
        sentence_endings = ["。", "！", "？", ".", "!", "?"]
        clause_boundaries = ["、", ";", ":", "；", "："]
        commas = ["，", ","]
    else:
        # Western sentence endings
        sentence_endings = [".", "!", "?"]
        clause_boundaries = [";", ":"]
        commas = [","]

    # Try to find sentence ending
    for ending in sentence_endings:
        pos = text.rfind(ending)
        if pos > len(text) * 0.3:  # At least 30% of the chunk
            return pos + 1

    # Try clause boundaries
    for boundary in clause_boundaries:
        pos = text.rfind(boundary)
        if pos > len(text) * 0.3:
            return pos + 1

    # Try comma
    for comma in commas:
        pos = text.rfind(comma)
        if pos > len(text) * 0.3:
            return pos + 1

    # Try space (for languages that use spaces)
    if language not in ["ko", "ja", "zh-cn"]:
        pos = text.rfind(" ")
        if pos > len(text) * 0.3:
            return pos + 1
    else:
        # For CJK, try to find any reasonable break point
        # Look for particles or common break characters
        for char in ["은", "는", "이", "가", "을", "를", "의", "에", "서", "도", " "]:
            pos = text.rfind(char)
            if pos > len(text) * 0.5:
                return pos + 1

    # No good split point found
    return 0


def estimate_chunks_count(text: str, language: str = "en") -> int:
    """
    Estimate how many chunks the text will be split into
    """
    char_limit = get_char_limit(language)
    if len(text) <= char_limit:
        return 1

    # Rough estimate (actual count may vary due to smart splitting)
    return (len(text) // char_limit) + 1
