import { Message, TextChannel, WebhookClient, GuildMember } from 'discord.js';
import { db } from '../database/client';
import { logger } from '../utils/logger';
import { TranslationGateway } from '../services/translation/gateway';
import { EmbedFactory } from '../utils/embeds';
import { ttsPlayer } from '../services/tts/player';

export class MessageHandler {
  private translationGateway: TranslationGateway;
  private webhookCache: Map<string, WebhookClient>;

  constructor() {
    this.translationGateway = new TranslationGateway();
    this.webhookCache = new Map();
  }

  async handleMessage(message: Message) {
    // Ignore bot messages
    if (message.author.bot) return;

    // Ignore messages without content
    if (!message.content || message.content.trim().length === 0) return;

    // Ignore messages without guild
    if (!message.guild) return;

    // Check if this channel is part of a translation pair
    await this.handleTranslation(message);

    // Check if this channel has TTS enabled
    await this.handleTTS(message);
  }

  private async handleTranslation(message: Message) {
    try {
      const result = await db.query(
        `SELECT id, target_channel_id, source_lang, target_lang, use_failsafe
         FROM translation_channels
         WHERE guild_id = $1
         AND source_channel_id = $2
         AND enabled = true`,
        [message.guildId, message.channelId]
      );

      if (result.rows.length === 0) return;

      for (const config of result.rows) {
        await this.translateAndSend(message, config);
      }
    } catch (error) {
      logger.error('Error handling translation', error);
    }
  }

  private async translateAndSend(message: Message, config: any) {
    try {
      // Translate the message
      const { text: translatedText, provider } = await this.translationGateway.translate(
        message.content,
        config.source_lang,
        config.target_lang,
        config.use_failsafe
      );

      // Get target channel
      const targetChannel = await message.guild?.channels.fetch(config.target_channel_id);

      if (!targetChannel || !targetChannel.isTextBased()) {
        logger.warn(`Target channel ${config.target_channel_id} not found or not text-based`);
        return;
      }

      // Create embed with translated message
      const embed = EmbedFactory.translatedMessage(
        message.author,
        translatedText,
        message.content,
        config.source_lang,
        config.target_lang
      );

      // Add provider info to footer
      const currentFooter = embed.data.footer?.text || '';
      embed.setFooter({
        text: `${currentFooter} | Provider: ${provider}`,
      });

      // Send to target channel
      await (targetChannel as TextChannel).send({ embeds: [embed] });

      logger.info('Message translated and sent', {
        from: message.channelId,
        to: config.target_channel_id,
        provider,
      });
    } catch (error) {
      logger.error('Error translating and sending message', error);
    }
  }

  /**
   * Handle TTS for messages in TTS-enabled channels
   */
  private async handleTTS(message: Message) {
    try {
      // Check if TTS is enabled for this channel
      const result = await db.query(
        `SELECT auto_join FROM tts_channels
         WHERE guild_id = $1 AND channel_id = $2 AND enabled = true`,
        [message.guildId, message.channelId]
      );

      if (result.rows.length === 0) return;

      const autoJoin = result.rows[0].auto_join;

      // Check if user is in a voice channel
      const member = message.member as GuildMember;
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        // User is not in a voice channel
        return;
      }

      // Get user's default voice
      const voiceResult = await db.query(
        `SELECT voice_name, language FROM user_voices
         WHERE user_id = $1 AND is_default = true`,
        [message.author.id]
      );

      if (voiceResult.rows.length === 0) {
        // User has no default voice registered
        logger.debug('User has no default voice registered', { userId: message.author.id });
        return;
      }

      const voiceName = voiceResult.rows[0].voice_name;
      const language = voiceResult.rows[0].language || 'en';

      // Limit text length
      const text = message.content.substring(0, 500);

      // Play TTS in user's voice channel
      await ttsPlayer.playTTS(voiceChannel, text, message.author.id, voiceName, language);

      logger.info('TTS played', {
        userId: message.author.id,
        channelId: voiceChannel.id,
        textLength: text.length,
      });
    } catch (error) {
      logger.error('Error handling TTS', error);
    }
  }

  /**
   * Get or create webhook for a channel (alternative to embeds)
   */
  private async getWebhook(channel: TextChannel): Promise<WebhookClient | null> {
    try {
      const cacheKey = channel.id;

      if (this.webhookCache.has(cacheKey)) {
        return this.webhookCache.get(cacheKey)!;
      }

      const webhooks = await channel.fetchWebhooks();
      let webhook = webhooks.find((wh) => wh.owner?.id === channel.client.user?.id);

      if (!webhook) {
        webhook = await channel.createWebhook({
          name: 'Translation Bot',
          reason: 'For translated messages',
        });
      }

      const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token! });
      this.webhookCache.set(cacheKey, webhookClient);

      return webhookClient;
    } catch (error) {
      logger.error('Error getting/creating webhook', error);
      return null;
    }
  }
}
