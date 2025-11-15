import axios from 'axios';
import { config } from '../../config/constants';
import { logger } from '../../utils/logger';

export class LibreTranslator {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.services.libreTranslateUrl;
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/translate`,
        {
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const translatedText = response.data.translatedText;

      logger.debug('LibreTranslate translation successful', {
        sourceLang,
        targetLang,
        originalLength: text.length,
        translatedLength: translatedText.length,
      });

      return translatedText;
    } catch (error: any) {
      logger.error('LibreTranslate translation failed', {
        error: error.message,
        sourceLang,
        targetLang,
      });
      throw new Error(`LibreTranslate translation failed: ${error.message}`);
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    try {
      const response = await axios.get(`${this.baseUrl}/languages`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get supported languages', error);
      return [];
    }
  }

  /**
   * Detect language
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/detect`, {
        q: text,
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].language;
      }

      return 'unknown';
    } catch (error) {
      logger.error('Language detection failed', error);
      return 'unknown';
    }
  }
}
