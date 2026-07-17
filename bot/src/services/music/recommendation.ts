import { db } from '../../database/client';
import { logger } from '../../utils/logger';
import { geminiService, RecommendationMode } from '../ai/gemini';

export interface RecommendationRequest {
  guildId: string;
  userId?: string; // set when scope = 'me'
  mode: RecommendationMode;
  count: number;
}

export interface RecommendationResult {
  queries: string[];
  geminiUsed: boolean;
}

interface HistoryRow {
  track_title: string;
  play_count: number;
}

/**
 * Turns raw music_history rows into a set of search queries to enqueue,
 * optionally generalized via Gemini. Falls back to weighted-random picks
 * from history when Gemini is unavailable or returns nothing usable.
 */
export class RecommendationService {
  private static readonly HISTORY_LIMIT = 50;

  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResult> {
    const history = await this.fetchHistory(request.guildId, request.userId);

    if (history.length === 0) {
      return { queries: [], geminiUsed: false };
    }

    if (geminiService.isAvailable()) {
      const suggestions = await geminiService.recommend(
        history.map((row) => ({ title: row.track_title, playCount: row.play_count })),
        { mode: request.mode, count: request.count }
      );

      if (suggestions.length > 0) {
        return { queries: suggestions, geminiUsed: true };
      }

      logger.warn('Gemini returned no usable suggestions, falling back to history', {
        guildId: request.guildId,
      });
    }

    return { queries: this.pickWeightedRandom(history, request.count), geminiUsed: false };
  }

  private async fetchHistory(guildId: string, userId?: string): Promise<HistoryRow[]> {
    const params: any[] = [guildId];
    let userFilter = '';

    if (userId) {
      params.push(userId);
      userFilter = `AND user_id = $${params.length}`;
    }

    const result = await db.query(
      `SELECT track_title, COUNT(*) AS play_count
       FROM music_history
       WHERE guild_id = $1
         AND track_title IS NOT NULL
         AND track_title <> ''
         AND track_title <> 'Unknown'
         ${userFilter}
       GROUP BY track_title
       ORDER BY play_count DESC, MAX(played_at) DESC
       LIMIT ${RecommendationService.HISTORY_LIMIT}`,
      params
    );

    return result.rows.map((row) => ({
      track_title: row.track_title,
      play_count: parseInt(row.play_count, 10),
    }));
  }

  /**
   * Pick `count` distinct titles from history, weighted by play count,
   * without replacement.
   */
  private pickWeightedRandom(history: HistoryRow[], count: number): string[] {
    const pool = [...history];
    const picked: string[] = [];

    while (picked.length < count && pool.length > 0) {
      const totalWeight = pool.reduce((sum, row) => sum + row.play_count, 0);
      let roll = Math.random() * totalWeight;
      let index = 0;

      for (; index < pool.length; index++) {
        roll -= pool[index].play_count;
        if (roll <= 0) {
          break;
        }
      }

      const chosen = pool.splice(Math.min(index, pool.length - 1), 1)[0];
      picked.push(chosen.track_title);
    }

    return picked;
  }
}

export const recommendationService = new RecommendationService();
