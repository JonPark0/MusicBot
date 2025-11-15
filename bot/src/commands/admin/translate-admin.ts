import {
  SlashCommandBuilder,
  CommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { db } from '../../database/client';
import { logger } from '../../utils/logger';
import { EmbedFactory } from '../../utils/embeds';
import { PermissionManager } from '../../middleware/permissions';
import { SUPPORTED_LANGUAGES, LanguageCode } from '../../config/constants';

export class TranslateAdminCommand {
  data = new SlashCommandBuilder()
    .setName('translate-admin')
    .setDescription('Admin commands for translation feature')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setup')
        .setDescription('Setup a translation channel pair')
        .addChannelOption((option) =>
          option
            .setName('source-channel')
            .setDescription('Source channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName('target-channel')
            .setDescription('Target channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('source-lang')
            .setDescription('Source language code (e.g., en, ko, ja)')
            .setRequired(true)
            .addChoices(
              ...Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
                name: name,
                value: code,
              }))
            )
        )
        .addStringOption((option) =>
          option
            .setName('target-lang')
            .setDescription('Target language code (e.g., en, ko, ja)')
            .setRequired(true)
            .addChoices(
              ...Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
                name: name,
                value: code,
              }))
            )
        )
        .addBooleanOption((option) =>
          option
            .setName('bidirectional')
            .setDescription('Enable bidirectional translation')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a translation channel pair')
        .addIntegerOption((option) =>
          option
            .setName('pair-id')
            .setDescription('Translation pair ID (from /translate-admin list)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List all translation channel pairs')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('enable')
        .setDescription('Enable a translation channel pair')
        .addIntegerOption((option) =>
          option.setName('pair-id').setDescription('Translation pair ID').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('disable')
        .setDescription('Disable a translation channel pair')
        .addIntegerOption((option) =>
          option.setName('pair-id').setDescription('Translation pair ID').setRequired(true)
        )
    );

  async execute(interaction: CommandInteraction) {
    // Check permissions
    const hasPermission = await PermissionManager.hasAdminPermission(interaction);
    if (!hasPermission) {
      await interaction.reply({
        embeds: [
          EmbedFactory.error('Permission Denied', 'You need administrator permissions to use this command.'),
        ],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.data[0].name;

    switch (subcommand) {
      case 'setup':
        await this.handleSetup(interaction);
        break;
      case 'remove':
        await this.handleRemove(interaction);
        break;
      case 'list':
        await this.handleList(interaction);
        break;
      case 'enable':
        await this.handleEnable(interaction);
        break;
      case 'disable':
        await this.handleDisable(interaction);
        break;
    }
  }

  private async handleSetup(interaction: CommandInteraction) {
    const sourceChannel = interaction.options.get('source-channel')?.channel;
    const targetChannel = interaction.options.get('target-channel')?.channel;
    const sourceLang = interaction.options.get('source-lang')?.value as string;
    const targetLang = interaction.options.get('target-lang')?.value as string;
    const bidirectional = interaction.options.get('bidirectional')?.value ?? true;

    try {
      // Insert translation pair
      await db.query(
        `INSERT INTO translation_channels
         (guild_id, source_channel_id, target_channel_id, source_lang, target_lang, bidirectional)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (guild_id, source_channel_id, target_channel_id)
         DO UPDATE SET source_lang = $4, target_lang = $5, bidirectional = $6, enabled = true`,
        [
          interaction.guildId,
          sourceChannel?.id,
          targetChannel?.id,
          sourceLang,
          targetLang,
          bidirectional,
        ]
      );

      // If bidirectional, also create reverse pair
      if (bidirectional) {
        await db.query(
          `INSERT INTO translation_channels
           (guild_id, source_channel_id, target_channel_id, source_lang, target_lang, bidirectional)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (guild_id, source_channel_id, target_channel_id)
           DO UPDATE SET source_lang = $4, target_lang = $5, bidirectional = $6, enabled = true`,
          [
            interaction.guildId,
            targetChannel?.id,
            sourceChannel?.id,
            targetLang,
            sourceLang,
            bidirectional,
          ]
        );
      }

      await interaction.reply({
        embeds: [
          EmbedFactory.success(
            'Translation Setup Complete',
            `Translation pair created:\n` +
              `${sourceChannel} (${sourceLang}) ↔ ${targetChannel} (${targetLang})\n` +
              `Bidirectional: ${bidirectional ? 'Yes' : 'No'}`
          ),
        ],
      });
    } catch (error) {
      logger.error('Error setting up translation', error);
      await interaction.reply({
        embeds: [
          EmbedFactory.error('Setup Failed', 'An error occurred while setting up translation.'),
        ],
        ephemeral: true,
      });
    }
  }

  private async handleRemove(interaction: CommandInteraction) {
    const pairId = interaction.options.get('pair-id')?.value as number;

    try {
      const result = await db.query(
        'DELETE FROM translation_channels WHERE id = $1 AND guild_id = $2 RETURNING *',
        [pairId, interaction.guildId]
      );

      if (result.rowCount === 0) {
        await interaction.reply({
          embeds: [EmbedFactory.error('Not Found', 'Translation pair not found.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedFactory.success('Removed', 'Translation pair has been removed.')],
      });
    } catch (error) {
      logger.error('Error removing translation pair', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to remove translation pair.')],
        ephemeral: true,
      });
    }
  }

  private async handleList(interaction: CommandInteraction) {
    try {
      const result = await db.query(
        `SELECT id, source_channel_id, target_channel_id, source_lang, target_lang, bidirectional, enabled
         FROM translation_channels
         WHERE guild_id = $1
         ORDER BY id`,
        [interaction.guildId]
      );

      if (result.rows.length === 0) {
        await interaction.reply({
          embeds: [
            EmbedFactory.info(
              'Translation Pairs',
              'No translation pairs configured for this server.'
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const description = result.rows
        .map((row) => {
          const status = row.enabled ? '✅' : '❌';
          const arrow = row.bidirectional ? '↔' : '→';
          return `**ID ${row.id}** ${status}\n<#${row.source_channel_id}> (${row.source_lang}) ${arrow} <#${row.target_channel_id}> (${row.target_lang})`;
        })
        .join('\n\n');

      await interaction.reply({
        embeds: [EmbedFactory.info('Translation Pairs', description)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error listing translation pairs', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to list translation pairs.')],
        ephemeral: true,
      });
    }
  }

  private async handleEnable(interaction: CommandInteraction) {
    const pairId = interaction.options.get('pair-id')?.value as number;

    try {
      await db.query(
        'UPDATE translation_channels SET enabled = true WHERE id = $1 AND guild_id = $2',
        [pairId, interaction.guildId]
      );

      await interaction.reply({
        embeds: [EmbedFactory.success('Enabled', 'Translation pair has been enabled.')],
      });
    } catch (error) {
      logger.error('Error enabling translation pair', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to enable translation pair.')],
        ephemeral: true,
      });
    }
  }

  private async handleDisable(interaction: CommandInteraction) {
    const pairId = interaction.options.get('pair-id')?.value as number;

    try {
      await db.query(
        'UPDATE translation_channels SET enabled = false WHERE id = $1 AND guild_id = $2',
        [pairId, interaction.guildId]
      );

      await interaction.reply({
        embeds: [EmbedFactory.success('Disabled', 'Translation pair has been disabled.')],
      });
    } catch (error) {
      logger.error('Error disabling translation pair', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to disable translation pair.')],
        ephemeral: true,
      });
    }
  }
}
