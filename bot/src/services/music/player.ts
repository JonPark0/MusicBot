import { VoiceChannel, GuildMember, Client } from 'discord.js';
import { LoopMode } from './queue';
import { MusicStreamingService, Track } from './streaming';
import { logger } from '../../utils/logger';
import { db } from '../../database/client';

export class MusicPlayer {
  private streamingService: MusicStreamingService;
  private client: Client;

  constructor(client: Client) {
    this.client = client;
    this.streamingService = new MusicStreamingService(client);
    this.setupEventListeners();
  }

  /**
   * Setup Lavalink event listeners
   */
  private setupEventListeners() {
    const manager = this.streamingService.getManager();

    // Track start event
    manager.on('trackStart', (player, track) => {
      logger.info('Playing track', {
        guildId: player.guildId,
        title: track.info?.title,
        url: track.info?.uri,
      });

      // Save to history
      this.saveToHistory(player.guildId, track).catch((error) => {
        logger.error('Failed to save music history', error);
      });
    });

    // Track end event
    manager.on('trackEnd', (player, track, reason) => {
      logger.debug('Track finished', {
        guildId: player.guildId,
        title: track.info?.title,
        reason,
      });
    });

    // Queue end event
    manager.on('queueEnd', (player) => {
      logger.info('Queue finished', { guildId: player.guildId });
    });

    // Track stuck event
    manager.on('trackStuck', (player, track) => {
      logger.warn('Track stuck', {
        guildId: player.guildId,
        title: track.info?.title,
      });
    });

    // Track error event
    manager.on('trackError', (player, track, exception) => {
      logger.error('Track error', {
        guildId: player.guildId,
        title: track?.info?.title,
        exception,
      });
    });

    // Player create event
    manager.on('playerCreate', (player) => {
      logger.info('Player created', { guildId: player.guildId });
    });

    // Player destroy event
    manager.on('playerDestroy', (player) => {
      logger.info('Player destroyed', { guildId: player.guildId });
    });
  }

  /**
   * Initialize the streaming service (should be called after bot is ready)
   */
  async initialize(): Promise<void> {
    const clientId = this.client.user?.id;
    if (!clientId) {
      throw new Error('Client ID not available');
    }
    await this.streamingService.initialize(clientId);
  }

  /**
   * Play a track or add to queue
   */
  async play(channel: VoiceChannel, query: string, requestedBy: GuildMember): Promise<Track | Track[] | null> {
    try {
      const manager = this.streamingService.getManager();

      if (!this.streamingService.isInitialized()) {
        logger.warn('Lavalink not initialized yet');
        return null;
      }

      // Get or create player for this guild
      let player = manager.players.get(channel.guild.id);

      if (!player) {
        player = manager.createPlayer({
          guildId: channel.guild.id,
          voiceChannelId: channel.id,
          textChannelId: channel.id, // Use voice channel id as text channel for now
          selfDeaf: true,
          volume: 50,
        });
      }

      // Update voice channel if different
      if (player.voiceChannelId !== channel.id) {
        player.voiceChannelId = channel.id;
      }

      // Connect to voice channel if not connected
      if (!player.connected) {
        await player.connect();
      }

      // Search for tracks
      const isUrl = this.streamingService.isURL(query);

      if (isUrl && (query.includes('playlist') || query.includes('list='))) {
        // Handle playlist
        const tracks = await this.streamingService.getPlaylist(query, requestedBy.id);
        if (tracks.length === 0) {
          logger.warn('No tracks found in playlist', { query });
          return null;
        }

        // Add all tracks to queue
        for (const track of tracks) {
          const result = await this.streamingService.search(track.url, requestedBy.id);
          if (result.length > 0) {
            const node = manager.nodeManager.leastUsedNodes()[0];
            if (node) {
              const searchResult = await node.search({ query: track.url }, requestedBy.id);
              if (searchResult.tracks.length > 0) {
                player.queue.add(searchResult.tracks[0]);
              }
            }
          }
        }

        // Start playing if not already
        if (!player.playing && !player.paused) {
          await player.play();
        }

        return tracks;
      } else {
        // Single track
        const searchQuery = isUrl ? query : `ytsearch:${query}`;
        const node = manager.nodeManager.leastUsedNodes()[0];

        if (!node) {
          logger.error('No Lavalink nodes available');
          return null;
        }

        const searchResult = await node.search({ query: searchQuery }, requestedBy.id);

        if (!searchResult || searchResult.loadType === 'error' || searchResult.loadType === 'empty') {
          logger.warn('No tracks found', { query });
          return null;
        }

        const lavalinkTrack = searchResult.tracks[0];
        player.queue.add(lavalinkTrack);

        // Start playing if not already
        if (!player.playing && !player.paused) {
          await player.play();
        }

        const track = this.convertLavalinkTrack(lavalinkTrack, requestedBy.id);
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
    const player = this.getPlayer(guildId);
    if (!player) {
      return false;
    }

    await player.skip();
    return true;
  }

  /**
   * Pause playback
   */
  async pause(guildId: string): Promise<boolean> {
    const player = this.getPlayer(guildId);
    if (!player || !player.playing) {
      return false;
    }

    await player.pause();
    return true;
  }

  /**
   * Resume playback
   */
  async resume(guildId: string): Promise<boolean> {
    const player = this.getPlayer(guildId);
    if (!player || player.playing) {
      return false;
    }

    await player.resume();
    return true;
  }

  /**
   * Stop playback and clear queue
   */
  async stop(guildId: string): Promise<void> {
    const player = this.getPlayer(guildId);
    if (!player) {
      return;
    }

    await player.destroy();
    logger.info('Stopped music playback', { guildId });
  }

  /**
   * Set volume
   */
  async setVolume(guildId: string, volume: number): Promise<boolean> {
    const player = this.getPlayer(guildId);
    if (!player) {
      return false;
    }

    const clampedVolume = Math.max(0, Math.min(100, volume));
    await player.setVolume(clampedVolume);
    return true;
  }

  /**
   * Get current volume
   */
  getVolume(guildId: string): number {
    const player = this.getPlayer(guildId);
    return player?.volume || 50;
  }

  /**
   * Shuffle queue
   */
  shuffle(guildId: string): boolean {
    const player = this.getPlayer(guildId);
    if (!player || player.queue.tracks.length === 0) {
      return false;
    }

    player.queue.shuffle();
    return true;
  }

  /**
   * Set loop mode
   */
  setLoopMode(guildId: string, mode: LoopMode): boolean {
    const player = this.getPlayer(guildId);
    if (!player) {
      return false;
    }

    switch (mode) {
      case LoopMode.OFF:
        player.setRepeatMode('off');
        break;
      case LoopMode.TRACK:
        player.setRepeatMode('track');
        break;
      case LoopMode.QUEUE:
        player.setRepeatMode('queue');
        break;
    }

    logger.debug('Loop mode changed', { guildId, mode });
    return true;
  }

  /**
   * Get loop mode
   */
  getLoopMode(guildId: string): LoopMode {
    const player = this.getPlayer(guildId);
    if (!player) {
      return LoopMode.OFF;
    }

    const repeatMode = player.repeatMode;
    if (repeatMode === 'track') {
      return LoopMode.TRACK;
    } else if (repeatMode === 'queue') {
      return LoopMode.QUEUE;
    }
    return LoopMode.OFF;
  }

  /**
   * Remove track from queue by position
   */
  removeTrack(guildId: string, position: number): boolean {
    const player = this.getPlayer(guildId);
    if (!player || position < 1 || position > player.queue.tracks.length) {
      return false;
    }

    player.queue.remove(position - 1); // 0-based index
    return true;
  }

  /**
   * Get queue tracks
   */
  getQueueTracks(guildId: string): Track[] {
    const player = this.getPlayer(guildId);
    if (!player) {
      return [];
    }

    return player.queue.tracks.map((track) => this.convertLavalinkTrack(track, ''));
  }

  /**
   * Get now playing track
   */
  getNowPlaying(guildId: string): Track | null {
    const player = this.getPlayer(guildId);
    if (!player || !player.queue.current) {
      return null;
    }

    return this.convertLavalinkTrack(player.queue.current, '');
  }

  /**
   * Check if player is active
   */
  isPlaying(guildId: string): boolean {
    const player = this.getPlayer(guildId);
    return player?.playing || false;
  }

  /**
   * Get queue size
   */
  getQueueSize(guildId: string): number {
    const player = this.getPlayer(guildId);
    return player?.queue.tracks.length || 0;
  }

  /**
   * Get total queue duration
   */
  getQueueDuration(guildId: string): number {
    const player = this.getPlayer(guildId);
    if (!player) {
      return 0;
    }

    let totalDuration = 0;
    for (const track of player.queue.tracks) {
      totalDuration += track.info?.duration || 0;
    }
    return Math.floor(totalDuration / 1000);
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
   * Get guild player
   */
  private getPlayer(guildId: string) {
    const manager = this.streamingService.getManager();
    return manager.players.get(guildId) || null;
  }

  /**
   * Convert Lavalink track to our Track interface
   */
  private convertLavalinkTrack(lavalinkTrack: any, requestedBy: string): Track {
    const requester = requestedBy || lavalinkTrack.requester;
    return {
      title: lavalinkTrack.info?.title || 'Unknown',
      url: lavalinkTrack.info?.uri || '',
      duration: Math.floor((lavalinkTrack.info?.duration || 0) / 1000),
      platform: this.getPlatform(lavalinkTrack),
      requestedBy: requester && requester !== 'null' && requester !== '' ? requester : null,
      thumbnail: lavalinkTrack.info?.artworkUrl || lavalinkTrack.info?.thumbnail || undefined,
    };
  }

  /**
   * Get platform name from track
   */
  private getPlatform(track: any): string {
    const sourceName = track.info?.sourceName?.toLowerCase() || '';
    const uri = track.info?.uri || '';

    if (sourceName.includes('youtube') || uri.includes('youtube.com') || uri.includes('youtu.be')) {
      return 'youtube';
    }
    if (sourceName.includes('spotify') || uri.includes('spotify.com')) {
      return 'spotify';
    }
    if (sourceName.includes('soundcloud') || uri.includes('soundcloud.com')) {
      return 'soundcloud';
    }
    if (sourceName.includes('bandcamp') || uri.includes('bandcamp.com')) {
      return 'bandcamp';
    }
    if (sourceName.includes('twitch') || uri.includes('twitch.tv')) {
      return 'twitch';
    }

    return sourceName || 'unknown';
  }

  /**
   * Save track to history
   */
  private async saveToHistory(guildId: string, track: any): Promise<void> {
    try {
      await db.query(
        `INSERT INTO music_history (guild_id, user_id, track_title, track_url, platform, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          guildId,
          track.requester || '',
          track.info?.title || 'Unknown',
          track.info?.uri || '',
          this.getPlatform(track),
          Math.floor((track.info?.duration || 0) / 1000),
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
