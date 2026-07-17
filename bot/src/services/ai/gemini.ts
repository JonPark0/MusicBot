import { config } from '../../config/constants';
import { logger } from '../../utils/logger';

export interface HistoryEntry {
  title: string;
  playCount: number;
}

export type RecommendationMode = 'mix' | 'discover';

export interface RecommendOptions {
  mode: RecommendationMode;
  count: number;
}

/**
 * Thin wrapper around the Gemini API used to generalize a group's noisy
 * play-history titles into clean song search queries.
 *
 * Uses Node's built-in `fetch` (Node 22) — no extra dependency required.
 */
export class GeminiService {
  private static readonly REQUEST_TIMEOUT_MS = 15000;

  /**
   * Whether a Gemini API key has been configured.
   */
  isAvailable(): boolean {
    return !!config.gemini.apiKey;
  }

  /**
   * Ask Gemini to generalize taste from history and suggest song search queries.
   * Returns an empty array on any failure so the caller can fall back gracefully.
   */
  async recommend(history: HistoryEntry[], opts: RecommendOptions): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const requestCount = opts.count * 2;
      const historyList = history
        .map((entry) => `- "${entry.title}" (played ${entry.playCount}x)`)
        .join('\n');

      const modeInstruction =
        opts.mode === 'discover'
          ? `Suggest songs that are NOT in the list above but strongly match the inferred taste (artists, genres, mood).`
          : `Suggest a mix: some of the listener's own favorites from the list above, plus new songs that match the inferred taste.`;

      const prompt = `You are a music recommendation engine for a Discord server's music bot.
Below is a list of raw, noisy track titles the server has played, with play counts. Titles may include
extra text like "(Official MV)", "[Lyrics]", channel names, etc. Infer the underlying music taste
(artists, genres, mood) from these titles.

${historyList}

${modeInstruction}

Return exactly ${requestCount} song suggestions as a JSON array of strings, each formatted as
"Artist - Song Title" (no extra commentary, no markdown, just the JSON array).`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GeminiService.REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        logger.warn('Gemini API request failed', { status: response.status });
        return [];
      }

      const data: any = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text || typeof text !== 'string') {
        logger.warn('Gemini API returned no text content');
        return [];
      }

      return this.parseSuggestions(text);
    } catch (error) {
      logger.error('Gemini recommendation failed', error);
      return [];
    }
  }

  /**
   * Defensively parse Gemini's text response into a string array,
   * tolerating stray markdown code fences around the JSON.
   */
  private parseSuggestions(text: string): string[] {
    try {
      const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    } catch (error) {
      logger.warn('Failed to parse Gemini response as JSON', { text });
      return [];
    }
  }
}

export const geminiService = new GeminiService();
