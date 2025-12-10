import { LavalinkManager, LavalinkNode } from 'lavalink-client';
import { Client, GatewayDispatchEvents } from 'discord.js';
import { logger } from '../../utils/logger';

export interface Track {
  title: string;
  url: string;
  duration: number;
  platform: string;
  requestedBy: string | null;
  thumbnail?: string;
}

export class MusicStreamingService {
  private manager: LavalinkManager;
  private initialized: boolean = false;

  constructor(client: Client) {
    const lavalinkHost = process.env.LAVALINK_HOST || 'lavalink';
    const lavalinkPort = parseInt(process.env.LAVALINK_PORT || '2333', 10);
    const lavalinkPassword = process.env.LAVALINK_PASSWORD || 'youshallnotpass';

    logger.info(`Initializing Lavalink manager with host: ${lavalinkHost}:${lavalinkPort}`);
    logger.debug(`Lavalink password: ${lavalinkPassword.substring(0, 3)}...${lavalinkPassword.substring(lavalinkPassword.length - 3)}`);

    const clientId = client.user?.id;
    const clientUsername = client.user?.username || 'DiscordBot';

    if (!clientId) {
      throw new Error('Client user ID is not available. Ensure the bot is logged in before initializing MusicStreamingService.');
    }

    logger.info(`Lavalink client ID: ${clientId}, username: ${clientUsername}`);

    this.manager = new LavalinkManager({
      nodes: [
        {
          authorization: lavalinkPassword,
          host: lavalinkHost,
          port: lavalinkPort,
          id: 'main',
          requestSignalTimeoutMS: 30000,
          closeOnError: false,
          heartBeatInterval: 30000,
          retryAmount: 5,
          retryDelay: 10000,
          secure: false,
        },
      ],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          guild.shard.send(payload);
        }
      },
      autoSkip: true,
      client: {
        id: clientId,
        username: clientUsername,
      },
      playerOptions: {
        defaultSearchPlatform: 'ytsearch',
        volumeDecrementer: 0.5,
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false,
        },
        onEmptyQueue: {
          destroyAfterMs: 300000, // 5 minutes
        },
      },
      advancedOptions: {
        enableDebugEvents: true,
        maxFilterFixDuration: 600000,
        debugOptions: {
          noAudio: false,
          playerDestroy: {
            dontThrowError: false,
            debugLog: true,
          },
        },
      },
    });

    this.setupEventHandlers(client);
  }

  private setupEventHandlers(client: Client) {
    // Forward Discord voice state updates to Lavalink
    client.on('raw', (d) => {
      if (
        d.t === GatewayDispatchEvents.VoiceStateUpdate ||
        d.t === GatewayDispatchEvents.VoiceServerUpdate
      ) {
        this.manager.sendRawData(d);
      }
    });

    // Lavalink node events
    this.manager.nodeManager.on('create', (node) => {
      logger.info(`Lavalink node created: ${node.id}`);
    });

    this.manager.nodeManager.on('connect', (node) => {
      logger.info(`Lavalink node connected: ${node.id}`);
      this.initialized = true;
    });

    this.manager.nodeManager.on('disconnect', (node) => {
      logger.warn(`Lavalink node disconnected: ${node.id}`);
    });

    this.manager.nodeManager.on('error', (node, error) => {
      logger.error(`Lavalink node error: ${node.id}`, { error: error.message });
    });

    this.manager.nodeManager.on('reconnecting', (node) => {
      logger.info(`Lavalink node reconnecting: ${node.id}`);
    });

    this.manager.nodeManager.on('resumed', (node, payload, players) => {
      logger.info(`Lavalink node resumed: ${node.id}, players: ${players}`);
    });
  }

  /**
   * Initialize the Lavalink manager
   */
  async initialize(clientId: string): Promise<void> {
    try {
      // Initialize the manager - this will connect to the nodes
      await this.manager.init({
        id: clientId,
        username: this.manager.options.client.username || 'DiscordBot',
      });
      this.initialized = true;
      logger.info('Lavalink manager initialized and connected');
    } catch (error) {
      logger.error('Failed to initialize Lavalink manager', error);
      throw error;
    }
  }

  /**
   * Get the Lavalink manager instance
   */
  getManager(): LavalinkManager {
    return this.manager;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Search for tracks using Lavalink
   */
  async search(query: string, requestedBy: string): Promise<Track[]> {
    try {
      if (!this.initialized) {
        logger.warn('Lavalink not initialized yet');
        return [];
      }

      // Add search prefix if not a URL
      let searchQuery = query;
      if (!query.startsWith('http')) {
        searchQuery = `ytsearch:${query}`;
      }

      const node = this.manager.nodeManager.leastUsedNodes()[0];
      if (!node) {
        logger.error('No Lavalink nodes available');
        return [];
      }

      const result = await node.search({ query: searchQuery }, requestedBy);

      if (!result || result.loadType === 'error' || result.loadType === 'empty') {
        logger.warn('No tracks found', { query });
        return [];
      }

      const tracks = result.tracks.slice(0, 10).map((track) => this.convertTrack(track, requestedBy));
      return tracks;
    } catch (error) {
      logger.error('Search failed', { error, query });
      return [];
    }
  }

  /**
   * Get track information from URL or search query
   */
  async getTrack(query: string, requestedBy: string): Promise<Track | null> {
    const tracks = await this.search(query, requestedBy);
    return tracks.length > 0 ? tracks[0] : null;
  }

  /**
   * Get playlist tracks
   */
  async getPlaylist(url: string, requestedBy: string): Promise<Track[]> {
    try {
      if (!this.initialized) {
        logger.warn('Lavalink not initialized yet');
        return [];
      }

      const node = this.manager.nodeManager.leastUsedNodes()[0];
      if (!node) {
        logger.error('No Lavalink nodes available');
        return [];
      }

      const result = await node.search({ query: url }, requestedBy);

      if (!result || result.loadType === 'error' || result.loadType === 'empty') {
        logger.warn('No tracks found in playlist', { url });
        return [];
      }

      if (result.loadType === 'playlist') {
        return result.tracks.map((track) => this.convertTrack(track, requestedBy));
      }

      // Single track
      return result.tracks.length > 0
        ? [this.convertTrack(result.tracks[0], requestedBy)]
        : [];
    } catch (error) {
      logger.error('Error getting playlist', { error, url });
      return [];
    }
  }

  /**
   * Convert Lavalink track to our Track interface
   */
  private convertTrack(lavalinkTrack: any, requestedBy: string): Track {
    return {
      title: lavalinkTrack.info?.title || 'Unknown',
      url: lavalinkTrack.info?.uri || '',
      duration: Math.floor((lavalinkTrack.info?.duration || 0) / 1000),
      platform: this.getPlatform(lavalinkTrack),
      requestedBy: requestedBy,
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
