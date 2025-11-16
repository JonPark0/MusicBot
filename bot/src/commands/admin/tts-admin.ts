import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { db } from '../../database/client';
import { logger } from '../../utils/logger';
import { EmbedFactory } from '../../utils/embeds';
import { PermissionManager } from '../../middleware/permissions';

export class TTSAdminCommand {
  data = new SlashCommandBuilder()
    .setName('tts-admin')
    .setDescription('Admin commands for TTS feature')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable-channel')
        .setDescription('Enable TTS in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Text channel to enable TTS')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('auto-join')
            .setDescription("Automatically join user's voice channel")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable-channel')
        .setDescription('Disable TTS in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Text channel to disable TTS')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list-channels').setDescription('List all TTS-enabled channels')
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const hasPermission = await PermissionManager.hasAdminPermission(interaction);
    if (!hasPermission) {
      await interaction.reply({
        embeds: [
          EmbedFactory.error(
            'Permission Denied',
            'You need administrator permissions to use this command.'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.data[0].name;

    switch (subcommand) {
      case 'enable-channel':
        await this.handleEnableChannel(interaction);
        break;
      case 'disable-channel':
        await this.handleDisableChannel(interaction);
        break;
      case 'list-channels':
        await this.handleListChannels(interaction);
        break;
    }
  }

  private async handleEnableChannel(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.get('channel')?.channel;
    const autoJoin = interaction.options.get('auto-join')?.value ?? true;

    try {
      await db.query(
        `INSERT INTO tts_channels (guild_id, channel_id, auto_join)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, channel_id)
         DO UPDATE SET enabled = true, auto_join = $3`,
        [interaction.guildId, channel?.id, autoJoin]
      );

      await interaction.reply({
        embeds: [
          EmbedFactory.success(
            'TTS Enabled',
            `TTS has been enabled in ${channel}\nAuto-join: ${autoJoin ? 'Yes' : 'No'}`
          ),
        ],
      });
    } catch (error) {
      logger.error('Error enabling TTS channel', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to enable TTS in this channel.')],
        ephemeral: true,
      });
    }
  }

  private async handleDisableChannel(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.get('channel')?.channel;

    try {
      await db.query(
        'UPDATE tts_channels SET enabled = false WHERE guild_id = $1 AND channel_id = $2',
        [interaction.guildId, channel?.id]
      );

      await interaction.reply({
        embeds: [EmbedFactory.success('TTS Disabled', `TTS has been disabled in ${channel}`)],
      });
    } catch (error) {
      logger.error('Error disabling TTS channel', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to disable TTS in this channel.')],
        ephemeral: true,
      });
    }
  }

  private async handleListChannels(interaction: ChatInputCommandInteraction) {
    try {
      const result = await db.query(
        `SELECT channel_id, enabled, auto_join
         FROM tts_channels
         WHERE guild_id = $1
         ORDER BY channel_id`,
        [interaction.guildId]
      );

      if (result.rows.length === 0) {
        await interaction.reply({
          embeds: [
            EmbedFactory.info('TTS Channels', 'No TTS channels configured for this server.'),
          ],
          ephemeral: true,
        });
        return;
      }

      const description = result.rows
        .map((row) => {
          const status = row.enabled ? '✅ Enabled' : '❌ Disabled';
          const autoJoin = row.auto_join ? '🔊 Auto-join' : '';
          return `<#${row.channel_id}> - ${status} ${autoJoin}`;
        })
        .join('\n');

      await interaction.reply({
        embeds: [EmbedFactory.info('TTS Channels', description)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error listing TTS channels', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to list TTS channels.')],
        ephemeral: true,
      });
    }
  }
}
