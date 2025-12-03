import { Message } from 'discord.js';
import { logger } from '../utils/logger';

export class MessageHandler {
  constructor() {}

  async handleMessage(message: Message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ignore messages without content
    if (!message.content || message.content.trim().length === 0) return;

    // Ignore messages without guild
    if (!message.guild) return;

    // Music bot only handles slash commands, no message-based features needed
    logger.debug('Message received', {
      userId: message.author.id,
      guildId: message.guildId,
      channelId: message.channelId,
    });
  }
}
