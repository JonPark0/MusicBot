import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from './config/constants';
import { logger } from './utils/logger';
import { db } from './database/client';
import { cache } from './utils/cache';
import { InteractionHandler } from './handlers/interactionHandler';
import { MessageHandler } from './handlers/messageHandler';

// Import commands
import { TranslateAdminCommand } from './commands/admin/translate-admin';
import { TTSAdminCommand } from './commands/admin/tts-admin';
import { MusicAdminCommand } from './commands/admin/music-admin';
import { TranslateCommand } from './commands/user/translate';
import { TTSCommand } from './commands/user/tts';
import { MusicCommand } from './commands/user/music';

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

      // Check database connection
      const dbHealthy = await db.healthCheck();
      if (dbHealthy) {
        logger.info('Database connection healthy');
      } else {
        logger.error('Database connection failed');
      }
    });

    this.client.on('interactionCreate', async (interaction) => {
      await this.interactionHandler.handleInteraction(interaction);
    });

    this.client.on('messageCreate', async (message) => {
      await this.messageHandler.handleMessage(message);
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
