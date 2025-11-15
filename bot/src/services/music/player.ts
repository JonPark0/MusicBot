import {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { MusicQueue, LoopMode } from './queue';
import { MusicStreamingService, Track } from './streaming';
import { logger } from '../../utils/logger';
import { db } from '../../database/client';

export class MusicPlayer {
  private connections: Map<string, VoiceConnection>;
  private players: Map<string, AudioPlayer>;
  private queues: Map<string, MusicQueue>;
  private streamingService: MusicStreamingService;
  private nowPlaying: Map<string, Track>;

  constructor() {
    this.connections = new Map();
    this.players = new Map();
    this.queues = new Map();
    this.streamingService = new MusicStreamingService();
    this.nowPlaying = new Map();
  }

  /**
   * Play a track or add to queue
   */
  async play(channel: VoiceChannel, track: Track): Promise<void> {
    const guildId = channel.guild.id;

    // Get or create queue
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new MusicQueue(guildId);
      this.queues.set(guildId, queue);
    }

    // Add track to queue
    queue.add(track);

    // Join voice channel if not already connected
    if (!this.connections.has(guildId)) {
      await this.joinChannel(channel);
    }

    // Start playing if nothing is currently playing
    const player = this.players.get(guildId);
    if (player && player.state.status !== AudioPlayerStatus.Playing) {
      await this.playNext(guildId);
    }
  }

  /**
   * Play a playlist
   */
  async playPlaylist(channel: VoiceChannel, tracks: Track[]): Promise<void> {
    const guildId = channel.guild.id;

    // Get or create queue
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new MusicQueue(guildId);
      this.queues.set(guildId, queue);
    }

    // Add all tracks to queue
    queue.addMultiple(tracks);

    // Join voice channel if not already connected
    if (!this.connections.has(guildId)) {
      await this.joinChannel(channel);
    }

    // Start playing if nothing is currently playing
    const player = this.players.get(guildId);
    if (player && player.state.status !== AudioPlayerStatus.Playing) {
      await this.playNext(guildId);
    }
  }

  /**
   * Join voice channel
   */
  private async joinChannel(channel: VoiceChannel): Promise<void> {
    const guildId = channel.guild.id;

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      logger.info('Joined voice channel for music', { channelId: channel.id, guildId });
    } catch (error) {
      logger.error('Failed to join voice channel for music', error);
      connection.destroy();
      throw new Error('Failed to connect to voice channel');
    }

    // Create audio player
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Handle player state changes
    player.on(AudioPlayerStatus.Idle, async () => {
      await this.handleTrackEnd(guildId);
    });

    player.on('error', (error) => {
      logger.error('Audio player error', error);
      this.handleTrackEnd(guildId);
    });

    // Handle connection events
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        logger.warn('Music voice connection disconnected', { guildId });
        this.cleanup(guildId);
      }
    });

    this.connections.set(guildId, connection);
    this.players.set(guildId, player);
  }

  /**
   * Play next track in queue
   */
  private async playNext(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    const player = this.players.get(guildId);

    if (!queue || !player) {
      return;
    }

    const track = queue.next();

    if (!track) {
      // Queue is empty
      logger.info('Queue finished', { guildId });
      this.nowPlaying.delete(guildId);
      return;
    }

    try {
      logger.info('Playing track', { guildId, title: track.title });

      // Create audio stream
      const resource = await this.streamingService.createAudioStream(track);

      // Set volume
      resource.volume?.setVolume(queue.getVolume() / 100);

      // Play audio
      player.play(resource);

      // Update now playing
      this.nowPlaying.set(guildId, track);

      // Save to history
      await this.saveToHistory(guildId, track);
    } catch (error) {
      logger.error('Failed to play track', { error, track });
      // Try next track
      await this.playNext(guildId);
    }
  }

  /**
   * Handle track end
   */
  private async handleTrackEnd(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);

    if (!queue) {
      return;
    }

    // If queue is not empty, play next track
    if (!queue.isEmpty() || queue.getLoopMode() !== LoopMode.OFF) {
      await this.playNext(guildId);
    } else {
      this.nowPlaying.delete(guildId);
    }
  }

  /**
   * Skip current track
   */
  async skip(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (player) {
      player.stop();
    }
  }

  /**
   * Pause playback
   */
  pause(guildId: string): boolean {
    const player = this.players.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Playing) {
      player.pause();
      return true;
    }
    return false;
  }

  /**
   * Resume playback
   */
  resume(guildId: string): boolean {
    const player = this.players.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      return true;
    }
    return false;
  }

  /**
   * Stop playback and leave channel
   */
  stop(guildId: string): void {
    const player = this.players.get(guildId);
    const connection = this.connections.get(guildId);

    if (player) {
      player.stop();
    }

    if (connection) {
      connection.destroy();
    }

    this.cleanup(guildId);
    logger.info('Stopped music playback', { guildId });
  }

  /**
   * Get queue for a guild
   */
  getQueue(guildId: string): MusicQueue | null {
    return this.queues.get(guildId) || null;
  }

  /**
   * Get now playing track
   */
  getNowPlaying(guildId: string): Track | null {
    return this.nowPlaying.get(guildId) || null;
  }

  /**
   * Check if player is active
   */
  isPlaying(guildId: string): boolean {
    const player = this.players.get(guildId);
    return player?.state.status === AudioPlayerStatus.Playing || false;
  }

  /**
   * Set volume
   */
  setVolume(guildId: string, volume: number): void {
    const queue = this.queues.get(guildId);
    const player = this.players.get(guildId);

    if (queue) {
      queue.setVolume(volume);
    }

    // Update current player volume
    if (player && player.state.status === AudioPlayerStatus.Playing) {
      const resource = (player.state as any).resource;
      if (resource?.volume) {
        resource.volume.setVolume(volume / 100);
      }
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(guildId: string): void {
    this.connections.delete(guildId);
    this.players.delete(guildId);
    this.queues.delete(guildId);
    this.nowPlaying.delete(guildId);
  }

  /**
   * Save track to history
   */
  private async saveToHistory(guildId: string, track: Track): Promise<void> {
    try {
      await db.query(
        `INSERT INTO music_history (guild_id, user_id, track_title, track_url, platform, duration_seconds)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [guildId, track.requestedBy, track.title, track.url, track.platform, track.duration]
      );
    } catch (error) {
      logger.error('Failed to save music history', error);
    }
  }
}

// Singleton instance
export const musicPlayer = new MusicPlayer();
