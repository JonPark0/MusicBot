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

export class MusicAdminCommand {
  data = new SlashCommandBuilder()
    .setName('music-admin')
    .setDescription('Admin commands for music bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable-channel')
        .setDescription('Enable music bot in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Text channel to enable music commands')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('max-queue-size')
            .setDescription('Maximum queue size (default: 100)')
            .setRequired(false)
            .setMinValue(10)
            .setMaxValue(500)
        )
        .addIntegerOption((option) =>
          option
            .setName('max-duration')
            .setDescription('Maximum track duration in seconds (default: 3600)')
            .setRequired(false)
            .setMinValue(60)
            .setMaxValue(7200)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable-channel')
        .setDescription('Disable music bot in a channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Text channel to disable music commands')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list-channels').setDescription('List all music-enabled channels')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-volume-limit')
        .setDescription('Set maximum volume limit')
        .addIntegerOption((option) =>
          option
            .setName('max-volume')
            .setDescription('Maximum volume (1-200)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(200)
        )
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
      case 'set-volume-limit':
        await this.handleSetVolumeLimit(interaction);
        break;
    }
  }

  private async handleEnableChannel(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.get('channel')?.channel;
    const maxQueueSize = (interaction.options.get('max-queue-size')?.value as number) || 100;
    const maxDuration = (interaction.options.get('max-duration')?.value as number) || 3600;

    try {
      await db.query(
        `INSERT INTO music_channels (guild_id, channel_id, max_queue_size, max_duration_seconds)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, channel_id)
         DO UPDATE SET enabled = true, max_queue_size = $3, max_duration_seconds = $4`,
        [interaction.guildId, channel?.id, maxQueueSize, maxDuration]
      );

      await interaction.reply({
        embeds: [
          EmbedFactory.success(
            'Music Bot Enabled',
            `Music bot has been enabled in ${channel}\n` +
              `Max queue size: ${maxQueueSize}\n` +
              `Max track duration: ${maxDuration}s`
          ),
        ],
      });
    } catch (error) {
      logger.error('Error enabling music channel', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to enable music bot in this channel.')],
        ephemeral: true,
      });
    }
  }

  private async handleDisableChannel(interaction: ChatInputCommandInteraction) {
    const channel = interaction.options.get('channel')?.channel;

    try {
      await db.query(
        'UPDATE music_channels SET enabled = false WHERE guild_id = $1 AND channel_id = $2',
        [interaction.guildId, channel?.id]
      );

      await interaction.reply({
        embeds: [
          EmbedFactory.success('Music Bot Disabled', `Music bot has been disabled in ${channel}`),
        ],
      });
    } catch (error) {
      logger.error('Error disabling music channel', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to disable music bot in this channel.')],
        ephemeral: true,
      });
    }
  }

  private async handleListChannels(interaction: ChatInputCommandInteraction) {
    try {
      const result = await db.query(
        `SELECT channel_id, enabled, max_queue_size, max_duration_seconds, volume_limit
         FROM music_channels
         WHERE guild_id = $1
         ORDER BY channel_id`,
        [interaction.guildId]
      );

      if (result.rows.length === 0) {
        await interaction.reply({
          embeds: [
            EmbedFactory.info('Music Channels', 'No music channels configured for this server.'),
          ],
          ephemeral: true,
        });
        return;
      }

      const description = result.rows
        .map((row) => {
          const status = row.enabled ? '✅ Enabled' : '❌ Disabled';
          return (
            `<#${row.channel_id}> - ${status}\n` +
            `  Queue: ${row.max_queue_size} | Duration: ${row.max_duration_seconds}s | Volume: ${row.volume_limit}%`
          );
        })
        .join('\n\n');

      await interaction.reply({
        embeds: [EmbedFactory.info('Music Channels', description)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error listing music channels', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to list music channels.')],
        ephemeral: true,
      });
    }
  }

  private async handleSetVolumeLimit(interaction: ChatInputCommandInteraction) {
    const maxVolume = interaction.options.get('max-volume')?.value as number;

    try {
      await db.query(
        'UPDATE music_channels SET volume_limit = $1 WHERE guild_id = $2',
        [maxVolume, interaction.guildId]
      );

      await interaction.reply({
        embeds: [
          EmbedFactory.success('Volume Limit Set', `Maximum volume set to ${maxVolume}%`),
        ],
      });
    } catch (error) {
      logger.error('Error setting volume limit', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to set volume limit.')],
        ephemeral: true,
      });
    }
  }
}
