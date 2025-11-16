import { Player, SearchResult, Track as DPTrack, QueryType } from 'discord-player';
import { Client } from 'discord.js';
import { logger } from '../../utils/logger';
import { config } from '../../config/constants';

export interface Track {
  title: string;
  url: string;
  duration: number;
  platform: string;
  requestedBy: string;
  thumbnail?: string;
}

export class MusicStreamingService {
  private player: Player;
  private initialized: boolean = false;

  constructor(client: Client) {
    this.player = new Player(client, {
      skipFFmpeg: false,
    });

    this.initializePlayer();
  }

  private async initializePlayer() {
    try {
      // Load default extractors (YouTube, Spotify, SoundCloud, etc.)
      await this.player.extractors.loadDefault();

      logger.info('Discord-player extractors loaded successfully');

      this.initialized = true;
      logger.info('Discord-player initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize discord-player', error);
      this.initialized = false;
    }
  }

  /**
   * Get the discord-player instance
   */
  getPlayer(): Player {
    return this.player;
  }

  /**
   * Check if player is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get track information from URL or search query
   */
  async getTrack(query: string, requestedBy: string): Promise<Track | null> {
    try {
      if (!this.initialized) {
        logger.warn('Player not initialized yet');
        return null;
      }

      const searchResult = await this.player.search(query, {
        requestedBy: requestedBy,
      });

      if (!searchResult || !searchResult.hasTracks()) {
        logger.warn('No tracks found', { query });
        return null;
      }

      const track = searchResult.tracks[0];
      return this.convertTrack(track, requestedBy);
    } catch (error) {
      logger.error('Error getting track info', { error, query });
      return null;
    }
  }

  /**
   * Get playlist tracks
   */
  async getPlaylist(url: string, requestedBy: string): Promise<Track[]> {
    try {
      if (!this.initialized) {
        logger.warn('Player not initialized yet');
        return [];
      }

      const searchResult = await this.player.search(url, {
        requestedBy: requestedBy,
      });

      if (!searchResult || !searchResult.hasTracks()) {
        logger.warn('No tracks found in playlist', { url });
        return [];
      }

      // If it's a playlist, return all tracks
      if (searchResult.playlist) {
        return searchResult.tracks.map((track) => this.convertTrack(track, requestedBy));
      }

      // Single track, return as array
      return [this.convertTrack(searchResult.tracks[0], requestedBy)];
    } catch (error) {
      logger.error('Error getting playlist', { error, url });
      return [];
    }
  }

  /**
   * Search for tracks
   */
  async search(query: string, limit: number = 5, requestedBy: string = ''): Promise<Track[]> {
    try {
      if (!this.initialized) {
        logger.warn('Player not initialized yet');
        return [];
      }

      const searchResult = await this.player.search(query, {
        requestedBy: requestedBy,
        searchEngine: QueryType.AUTO,
      });

      if (!searchResult || !searchResult.hasTracks()) {
        logger.warn('No search results', { query });
        return [];
      }

      return searchResult.tracks
        .slice(0, limit)
        .map((track) => this.convertTrack(track, requestedBy));
    } catch (error) {
      logger.error('Search failed', { error, query });
      return [];
    }
  }

  /**
   * Convert discord-player Track to our Track interface
   */
  private convertTrack(dpTrack: DPTrack, requestedBy: string): Track {
    return {
      title: dpTrack.title,
      url: dpTrack.url,
      duration: Math.floor(dpTrack.durationMS / 1000),
      platform: this.getPlatform(dpTrack),
      requestedBy: requestedBy,
      thumbnail: dpTrack.thumbnail,
    };
  }

  /**
   * Get platform name from track
   */
  private getPlatform(track: DPTrack): string {
    const source = track.raw?.source || track.source;

    if (typeof source === 'string') {
      const sourceLower = source.toLowerCase();
      if (sourceLower.includes('youtube')) return 'youtube';
      if (sourceLower.includes('spotify')) return 'spotify';
      if (sourceLower.includes('soundcloud')) return 'soundcloud';
    }

    // Fallback to checking URL
    if (track.url.includes('youtube.com') || track.url.includes('youtu.be')) {
      return 'youtube';
    }
    if (track.url.includes('spotify.com')) {
      return 'spotify';
    }
    if (track.url.includes('soundcloud.com')) {
      return 'soundcloud';
    }

    return 'unknown';
  }

  /**
   * Validate if a query is a URL
   */
  isURL(query: string): boolean {
    try {
      new URL(query);
      return true;
    } catch {
      return false;
    }
  }
}
