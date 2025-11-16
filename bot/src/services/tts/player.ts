import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnection,
  AudioPlayer,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { TTSClient } from './client';
import fs from 'fs';
import path from 'path';

interface TTSQueue {
  text: string;
  userId: string;
  voiceName?: string;
  language: string;
  speed?: number;
  model?: string;
  exaggeration?: number;
}

export class TTSPlayer {
  private connections: Map<string, VoiceConnection>;
  private players: Map<string, AudioPlayer>;
  private queues: Map<string, TTSQueue[]>;
  private ttsClient: TTSClient;
  private processing: Map<string, boolean>;

  constructor() {
    this.connections = new Map();
    this.players = new Map();
    this.queues = new Map();
    this.ttsClient = new TTSClient();
    this.processing = new Map();
  }

  /**
   * Join a voice channel
   */
  async joinChannel(channel: VoiceChannel): Promise<VoiceConnection> {
    const guildId = channel.guild.id;

    // If already connected, return existing connection
    if (this.connections.has(guildId)) {
      return this.connections.get(guildId)!;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator as any,
    });

    // Wait for connection to be ready
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      logger.info('Joined voice channel', { channelId: channel.id, guildId });
    } catch (error) {
      logger.error('Failed to join voice channel', error);
      connection.destroy();
      throw new Error('Failed to connect to voice channel');
    }

    // Create audio player
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Handle player events
    player.on(AudioPlayerStatus.Idle, () => {
      this.processQueue(guildId);
    });

    player.on('error', (error) => {
      logger.error('Audio player error', error);
      this.processQueue(guildId);
    });

    // Handle connection events
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        logger.warn('Voice connection disconnected', { guildId });
        this.cleanup(guildId);
      }
    });

    this.connections.set(guildId, connection);
    this.players.set(guildId, player);
    this.queues.set(guildId, []);

    return connection;
  }

  /**
   * Add TTS to queue and play
   */
  async playTTS(
    channel: VoiceChannel,
    text: string,
    userId: string,
    voiceName?: string,
    language: string = 'en',
    speed: number = 1.0,
    model?: string,
    exaggeration?: number
  ): Promise<void> {
    const guildId = channel.guild.id;

    // Ensure connected to voice channel
    if (!this.connections.has(guildId)) {
      await this.joinChannel(channel);
    }

    // Add to queue
    const queue = this.queues.get(guildId) || [];
    queue.push({ text, userId, voiceName, language, speed, model, exaggeration });
    this.queues.set(guildId, queue);

    logger.info('TTS added to queue', { guildId, queueLength: queue.length });

    // Process queue if not already processing
    if (!this.processing.get(guildId)) {
      await this.processQueue(guildId);
    }
  }

  /**
   * Process TTS queue
   */
  private async processQueue(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    const player = this.players.get(guildId);

    if (!queue || queue.length === 0 || !player) {
      this.processing.set(guildId, false);
      return;
    }

    // Check if player is already playing
    if (player.state.status === AudioPlayerStatus.Playing) {
      return;
    }

    this.processing.set(guildId, true);

    const item = queue.shift()!;
    this.queues.set(guildId, queue);

    try {
      logger.info('Processing TTS', { guildId, text: item.text.substring(0, 50) });

      // Synthesize speech
      const audioBuffer = await this.ttsClient.synthesize(
        item.userId,
        item.text,
        item.voiceName,
        item.language,
        item.speed || 1.0,
        item.model,
        item.exaggeration
      );

      // Save to temporary file
      const tempFile = path.join('/tmp', `tts_${Date.now()}.wav`);
      fs.writeFileSync(tempFile, audioBuffer);

      // Create audio resource
      const resource = createAudioResource(tempFile);

      // Play audio
      player.play(resource);

      // Clean up temp file after playing
      player.once(AudioPlayerStatus.Idle, () => {
        try {
          fs.unlinkSync(tempFile);
        } catch (error) {
          logger.error('Failed to delete temp file', error);
        }
      });
    } catch (error) {
      logger.error('Failed to process TTS', error);
      this.processing.set(guildId, false);
      // Continue processing queue
      await this.processQueue(guildId);
    }
  }

  /**
   * Leave voice channel
   */
  leaveChannel(guildId: string): void {
    const connection = this.connections.get(guildId);
    if (connection) {
      connection.destroy();
    }
    this.cleanup(guildId);
    logger.info('Left voice channel', { guildId });
  }

  /**
   * Cleanup resources for a guild
   */
  private cleanup(guildId: string): void {
    this.connections.delete(guildId);
    this.players.delete(guildId);
    this.queues.delete(guildId);
    this.processing.delete(guildId);
  }

  /**
   * Get queue length
   */
  getQueueLength(guildId: string): number {
    return this.queues.get(guildId)?.length || 0;
  }

  /**
   * Clear queue
   */
  clearQueue(guildId: string): void {
    this.queues.set(guildId, []);
    logger.info('TTS queue cleared', { guildId });
  }

  /**
   * Check if bot is in voice channel
   */
  isInChannel(guildId: string): boolean {
    return this.connections.has(guildId);
  }
}

// Singleton instance
export const ttsPlayer = new TTSPlayer();
