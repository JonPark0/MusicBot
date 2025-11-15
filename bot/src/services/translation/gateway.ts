import crypto from 'crypto';
import { GeminiTranslator } from './gemini';
import { LibreTranslator } from './libretranslate';
import { cache } from '../../utils/cache';
import { logger } from '../../utils/logger';

export class TranslationGateway {
  private gemini: GeminiTranslator;
  private libre: LibreTranslator;
  private cacheEnabled: boolean = true;
  private cacheTTL: number = 86400; // 24 hours

  constructor() {
    this.gemini = new GeminiTranslator();
    this.libre = new LibreTranslator();
  }

  /**
   * Translate text with automatic failover
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    useFailsafe: boolean = true
  ): Promise<{ text: string; provider: string }> {
    // Check cache first
    if (this.cacheEnabled) {
      const cached = await this.getCachedTranslation(text, sourceLang, targetLang);
      if (cached) {
        logger.debug('Translation retrieved from cache');
        return { text: cached.text, provider: cached.provider };
      }
    }

    // Try Gemini first
    try {
      const translatedText = await this.gemini.translate(text, sourceLang, targetLang);

      // Cache the result
      if (this.cacheEnabled) {
        await this.cacheTranslation(text, sourceLang, targetLang, translatedText, 'gemini');
      }

      return { text: translatedText, provider: 'gemini' };
    } catch (error) {
      logger.warn('Gemini translation failed, trying failsafe', error);

      // Try LibreTranslate as failsafe
      if (useFailsafe) {
        try {
          const translatedText = await this.libre.translate(text, sourceLang, targetLang);

          // Cache the result
          if (this.cacheEnabled) {
            await this.cacheTranslation(
              text,
              sourceLang,
              targetLang,
              translatedText,
              'libretranslate'
            );
          }

          return { text: translatedText, provider: 'libretranslate' };
        } catch (libreError) {
          logger.error('Both translation providers failed', libreError);
          throw new Error('Translation failed: All providers unavailable');
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      return await this.gemini.detectLanguage(text);
    } catch (error) {
      logger.warn('Gemini language detection failed, trying LibreTranslate');
      try {
        return await this.libre.detectLanguage(text);
      } catch (libreError) {
        logger.error('Language detection failed', libreError);
        return 'unknown';
      }
    }
  }

  /**
   * Get cached translation
   */
  private async getCachedTranslation(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ text: string; provider: string } | null> {
    const cacheKey = this.generateCacheKey(text, sourceLang, targetLang);
    const cached = await cache.get(`translation:${cacheKey}`);

    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        logger.error('Failed to parse cached translation', error);
        return null;
      }
    }

    return null;
  }

  /**
   * Cache translation result
   */
  private async cacheTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    translatedText: string,
    provider: string
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(text, sourceLang, targetLang);
    const cacheValue = JSON.stringify({ text: translatedText, provider });

    await cache.set(`translation:${cacheKey}`, cacheValue, this.cacheTTL);
  }

  /**
   * Generate cache key from text and languages
   */
  private generateCacheKey(text: string, sourceLang: string, targetLang: string): string {
    return crypto
      .createHash('sha256')
      .update(`${sourceLang}:${targetLang}:${text}`)
      .digest('hex');
  }

  /**
   * Clear cache for specific translation
   */
  async clearCache(text: string, sourceLang: string, targetLang: string): Promise<void> {
    const cacheKey = this.generateCacheKey(text, sourceLang, targetLang);
    await cache.del(`translation:${cacheKey}`);
  }

  /**
   * Enable/disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
  }
}
