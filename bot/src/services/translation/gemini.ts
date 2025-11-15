import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/constants';
import { logger } from '../../utils/logger';

export class GeminiTranslator {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.services.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    try {
      const prompt = this.buildPrompt(text, sourceLang, targetLang);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const translatedText = response.text().trim();

      logger.debug('Gemini translation successful', {
        sourceLang,
        targetLang,
        originalLength: text.length,
        translatedLength: translatedText.length,
      });

      return translatedText;
    } catch (error) {
      logger.error('Gemini translation failed', { error, sourceLang, targetLang });
      throw new Error(`Gemini translation failed: ${error}`);
    }
  }

  private buildPrompt(text: string, sourceLang: string, targetLang: string): string {
    return `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.

Important rules:
- Preserve all formatting (line breaks, emojis, Discord mentions like @user or #channel, custom emojis like <:name:id>)
- If the text contains mixed languages, translate only the parts that need translation
- Maintain the original tone and context
- For Discord mentions (@user, @role, #channel), keep them EXACTLY as-is
- For URLs and links, keep them unchanged
- For technical terms or proper nouns, keep them unchanged if appropriate
- For code blocks (\`\`\`), keep them unchanged
- Respond with ONLY the translated text, no explanations or additional comments

Text to translate:
${text}`;
  }

  /**
   * Detect language of text (optional feature)
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      const prompt = `Detect the primary language of this text and respond with ONLY the ISO 639-1 language code (e.g., "en", "ko", "ja"):

${text}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim().toLowerCase();
    } catch (error) {
      logger.error('Language detection failed', error);
      return 'unknown';
    }
  }
}
