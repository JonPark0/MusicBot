import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config/constants';
import { logger } from './utils/logger';
import { db } from './database/client';
import { cache } from './utils/cache';
import { InteractionHandler } from './handlers/interactionHandler';
import { MessageHandler } from './handlers/messageHandler';
import { initializeMusicPlayer, getMusicPlayer } from './services/music/player';
import { ttsPlayer } from './services/tts/player';

// Import commands
import { TranslateAdminCommand } from './commands/admin/translate-admin';
import { TTSAdminCommand } from './commands/admin/tts-admin';
import { MusicAdminCommand } from './commands/admin/music-admin';
import { TranslateCommand } from './commands/user/translate';
import { TTSCommand } from './commands/user/tts';
import { MusicCommand } from './commands/user/music';

// Validate required environment variables
function validateEnvironment() {
  const required = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID',
    'GEMINI_API_KEY',
    'DATABASE_URL',
    'REDIS_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  logger.info('Environment validation passed');
}

validateEnvironment();

class DiscordBot {
  private client: Client;
  private interactionHandler: InteractionHandler;
  private messageHandler: MessageHandler;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    });

    this.interactionHandler = new InteractionHandler();
    this.messageHandler = new MessageHandler();

    this.registerCommands();
    this.registerEventHandlers();
  }

  private registerCommands() {
    // Admin commands
    this.interactionHandler.registerCommand(new TranslateAdminCommand());
    this.interactionHandler.registerCommand(new TTSAdminCommand());
    this.interactionHandler.registerCommand(new MusicAdminCommand());

    // User commands
    this.interactionHandler.registerCommand(new TranslateCommand());
    this.interactionHandler.registerCommand(new TTSCommand());
    this.interactionHandler.registerCommand(new MusicCommand());
  }

  private registerEventHandlers() {
    this.client.once('ready', async () => {
      logger.info(`Bot logged in as ${this.client.user?.tag}`);
      logger.info(`Serving ${this.client.guilds.cache.size} guilds`);

      // Initialize music player
      const musicPlayer = initializeMusicPlayer(this.client);
      logger.info('Music player created');

      // Initialize Lavalink connection
      try {
        await musicPlayer.initialize();
        logger.info('Lavalink manager initialized');
      } catch (error) {
        logger.error('Failed to initialize Lavalink', error);
      }

      // Check database connection
      const dbHealthy = await db.healthCheck();
      if (dbHealthy) {
        logger.info('Database connection healthy');
      } else {
        logger.error('Database connection failed');
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      try {
        await this.interactionHandler.handleInteraction(interaction);
      } catch (error) {
        logger.error('Unhandled error in interaction handler', error);
      }
    });

    this.client.on('messageCreate', async (message) => {
      try {
        await this.messageHandler.handleMessage(message);
      } catch (error) {
        logger.error('Unhandled error in message handler', error);
      }
    });

    // Cleanup resources when bot leaves a guild
    this.client.on('guildDelete', async (guild) => {
      try {
        logger.info(`Bot removed from guild: ${guild.name} (${guild.id})`);

        // Stop music player if active
        try {
          const musicPlayer = getMusicPlayer();
          await musicPlayer.stop(guild.id);
        } catch (error) {
          logger.debug('Music player not initialized yet');
        }

        // Stop TTS player if active
        ttsPlayer.leaveChannel(guild.id);

        logger.info(`Cleaned up resources for guild ${guild.id}`);
      } catch (error) {
        logger.error('Error cleaning up guild resources', error);
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error', error);
    });

    this.client.on('warn', (warning) => {
      logger.warn('Discord client warning', warning);
    });
  }

  async start() {
    try {
      // Connect to Redis
      await cache.connect();
      logger.info('Redis connected');

      // Login to Discord
      await this.client.login(config.discord.token);
    } catch (error) {
      logger.error('Failed to start bot', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down bot...');
    await cache.disconnect();
    await db.close();
    this.client.destroy();
    logger.info('Bot shut down successfully');
  }
}

// Initialize and start bot
const bot = new DiscordBot();

// Graceful shutdown
process.on('SIGINT', async () => {
  await bot.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await bot.shutdown();
  process.exit(0);
});

// Start the bot
bot.start();
