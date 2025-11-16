import { GuildQueue, QueueRepeatMode, Track as DPTrack } from 'discord-player';
import { VoiceChannel, GuildMember } from 'discord.js';
import { LoopMode } from './queue';
import { MusicStreamingService, Track } from './streaming';
import { logger } from '../../utils/logger';
import { db } from '../../database/client';
import { Client } from 'discord.js';

export class MusicPlayer {
  private streamingService: MusicStreamingService;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    this.streamingService = new MusicStreamingService(client);
    this.setupEventListeners();
  }

  /**
   * Setup discord-player event listeners
   */
  private setupEventListeners() {
    const player = this.streamingService.getPlayer();

    // Track start event
    player.events.on('playerStart', (queue, track) => {
      logger.info('Playing track', {
        guildId: queue.guild.id,
        title: track.title,
        url: track.url,
      });

      // Save to history
      this.saveToHistory(queue.guild.id, track).catch((error) => {
        logger.error('Failed to save music history', error);
      });
    });

    // Track end event
    player.events.on('playerFinish', (queue, track) => {
      logger.debug('Track finished', {
        guildId: queue.guild.id,
        title: track.title,
      });
    });

    // Queue end event
    player.events.on('emptyQueue', (queue) => {
      logger.info('Queue finished', { guildId: queue.guild.id });
    });

    // Audio player error (critical for debugging)
    player.events.on('audioTrackAdd', (queue, track) => {
      logger.debug('Track added to queue', {
        guildId: queue.guild.id,
        title: track.title,
      });
    });

    // Connection events
    player.events.on('connection', (queue) => {
      logger.info('Voice connection established', { guildId: queue.guild.id });
    });

    player.events.on('disconnect', (queue) => {
      logger.warn('Voice connection disconnected', { guildId: queue.guild.id });
    });

    // Error events
    player.events.on('playerError', (queue, error, track) => {
      logger.error('Player error', {
        guildId: queue.guild.id,
        track: track.title,
        error: error.message,
        stack: error.stack,
      });
    });

    player.events.on('error', (queue, error) => {
      logger.error('Queue error', {
        guildId: queue.guild.id,
        error: error.message,
        stack: error.stack,
      });
    });

    // Debug event for stream issues
    player.events.on('debug', (queue, message) => {
      logger.debug('Player debug', { guildId: queue.guild.id, message });
    });
  }

  /**
   * Play a track or add to queue
   */
  async play(channel: VoiceChannel, query: string, requestedBy: GuildMember): Promise<Track | Track[] | null> {
    try {
      const player = this.streamingService.getPlayer();

      // Search for the track/playlist
      const searchResult = await player.search(query, {
        requestedBy: requestedBy.user,
      });

      if (!searchResult || !searchResult.hasTracks()) {
        logger.warn('No tracks found', { query });
        return null;
      }

      // Get or create queue
      let queue = player.nodes.get(channel.guild.id);

      if (!queue) {
        queue = player.nodes.create(channel.guild, {
          metadata: {
            channel: channel,
          },
          leaveOnEnd: false,
          leaveOnStop: false,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, // 5 minutes
          selfDeaf: true,
          volume: 50,
          bufferingTimeout: 30000, // 30 seconds for slow connections
          connectionTimeout: 30000, // 30 seconds to establish connection
          skipOnNoStream: true, // Skip track if stream fails
        });
      }

      // Connect to voice channel if not connected
      if (!queue.connection) {
        await queue.connect(channel);
      }

      // Add track(s) to queue
      if (searchResult.playlist) {
        // It's a playlist
        queue.addTrack(searchResult.tracks);
        const tracks = searchResult.tracks.map((t) => this.convertTrack(t, requestedBy.id));

        // Start playing if not already
        if (!queue.isPlaying()) {
          await queue.node.play();
        }

        return tracks;
      } else {
        // Single track
        queue.addTrack(searchResult.tracks[0]);
        const track = this.convertTrack(searchResult.tracks[0], requestedBy.id);

        // Start playing if not already
        if (!queue.isPlaying()) {
          await queue.node.play();
        }

        return track;
      }
    } catch (error) {
      logger.error('Failed to play track', { error, query });
      throw error;
    }
  }

  /**
   * Skip current track
   */
  async skip(guildId: string): Promise<boolean> {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return false;
    }

    queue.node.skip();
    return true;
  }

  /**
   * Pause playback
   */
  pause(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.isPlaying()) {
      return false;
    }

    queue.node.pause();
    return true;
  }

  /**
   * Resume playback
   */
  resume(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || queue.isPlaying()) {
      return false;
    }

    queue.node.resume();
    return true;
  }

  /**
   * Stop playback and clear queue
   */
  stop(guildId: string): void {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return;
    }

    queue.delete();
    logger.info('Stopped music playback', { guildId });
  }

  /**
   * Set volume
   */
  setVolume(guildId: string, volume: number): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return false;
    }

    const clampedVolume = Math.max(0, Math.min(100, volume));
    queue.node.setVolume(clampedVolume);
    return true;
  }

  /**
   * Get current volume
   */
  getVolume(guildId: string): number {
    const queue = this.getQueue(guildId);
    return queue?.node.volume || 50;
  }

  /**
   * Shuffle queue
   */
  shuffle(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || queue.isEmpty()) {
      return false;
    }

    queue.tracks.shuffle();
    return true;
  }

  /**
   * Set loop mode
   */
  setLoopMode(guildId: string, mode: LoopMode): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return false;
    }

    switch (mode) {
      case LoopMode.OFF:
        queue.setRepeatMode(QueueRepeatMode.OFF);
        break;
      case LoopMode.TRACK:
        queue.setRepeatMode(QueueRepeatMode.TRACK);
        break;
      case LoopMode.QUEUE:
        queue.setRepeatMode(QueueRepeatMode.QUEUE);
        break;
    }

    logger.debug('Loop mode changed', { guildId, mode });
    return true;
  }

  /**
   * Get loop mode
   */
  getLoopMode(guildId: string): LoopMode {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return LoopMode.OFF;
    }

    switch (queue.repeatMode) {
      case QueueRepeatMode.TRACK:
        return LoopMode.TRACK;
      case QueueRepeatMode.QUEUE:
        return LoopMode.QUEUE;
      default:
        return LoopMode.OFF;
    }
  }

  /**
   * Remove track from queue by position
   */
  removeTrack(guildId: string, position: number): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || position < 1 || position > queue.tracks.size) {
      return false;
    }

    queue.node.remove(position - 1); // discord-player uses 0-based index
    return true;
  }

  /**
   * Get queue tracks
   */
  getQueueTracks(guildId: string): Track[] {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return [];
    }

    return queue.tracks.map((track) => this.convertTrack(track, ''));
  }

  /**
   * Get now playing track
   */
  getNowPlaying(guildId: string): Track | null {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.currentTrack) {
      return null;
    }

    return this.convertTrack(queue.currentTrack, '');
  }

  /**
   * Check if player is active
   */
  isPlaying(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    return queue?.isPlaying() || false;
  }

  /**
   * Get queue size
   */
  getQueueSize(guildId: string): number {
    const queue = this.getQueue(guildId);
    return queue?.tracks.size || 0;
  }

  /**
   * Get total queue duration
   */
  getQueueDuration(guildId: string): number {
    const queue = this.getQueue(guildId);
    if (!queue) {
      return 0;
    }

    return Math.floor(queue.estimatedDuration / 1000);
  }

  /**
   * Get paginated queue tracks
   */
  getPaginatedTracks(
    guildId: string,
    page: number = 1,
    perPage: number = 10
  ): { tracks: Track[]; totalPages: number } {
    const allTracks = this.getQueueTracks(guildId);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const totalPages = Math.ceil(allTracks.length / perPage);

    return {
      tracks: allTracks.slice(start, end),
      totalPages: totalPages || 1,
    };
  }

  /**
   * Get guild queue
   */
  private getQueue(guildId: string): GuildQueue | null {
    const player = this.streamingService.getPlayer();
    return player.nodes.get(guildId) || null;
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
      requestedBy: requestedBy || dpTrack.requestedBy?.id || '',
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
   * Save track to history
   */
  private async saveToHistory(guildId: string, track: DPTrack): Promise<void> {
    try {
      await db.query(
        `INSERT INTO music_history (guild_id, user_id, track_title, track_url, platform, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          guildId,
          track.requestedBy?.id || '',
          track.title,
          track.url,
          this.getPlatform(track),
          Math.floor(track.durationMS / 1000),
        ]
      );
    } catch (error) {
      logger.error('Failed to save music history', error);
    }
  }

  /**
   * Get streaming service (for initialization in main bot)
   */
  getStreamingService(): MusicStreamingService {
    return this.streamingService;
  }
}

// Note: Singleton will be created in index.ts after client is initialized
let musicPlayerInstance: MusicPlayer | null = null;

export function initializeMusicPlayer(client: Client): MusicPlayer {
  if (!musicPlayerInstance) {
    musicPlayerInstance = new MusicPlayer(client);
  }
  return musicPlayerInstance;
}

export function getMusicPlayer(): MusicPlayer {
  if (!musicPlayerInstance) {
    throw new Error('Music player not initialized. Call initializeMusicPlayer first.');
  }
  return musicPlayerInstance;
}
