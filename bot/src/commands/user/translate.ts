import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { db } from '../../database/client';
import { logger } from '../../utils/logger';
import { EmbedFactory } from '../../utils/embeds';

export class TranslateCommand {
  data = new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translation feature commands')
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Check translation status for current channel')
    );

  async execute(interaction: CommandInteraction) {
    const subcommand = interaction.options.data[0].name;

    switch (subcommand) {
      case 'status':
        await this.handleStatus(interaction);
        break;
    }
  }

  private async handleStatus(interaction: CommandInteraction) {
    try {
      const result = await db.query(
        `SELECT target_channel_id, source_lang, target_lang, bidirectional, enabled
         FROM translation_channels
         WHERE guild_id = $1
         AND source_channel_id = $2`,
        [interaction.guildId, interaction.channelId]
      );

      if (result.rows.length === 0) {
        await interaction.reply({
          embeds: [
            EmbedFactory.info(
              'Translation Status',
              'This channel does not have translation enabled.'
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const pairs = result.rows
        .map((row) => {
          const status = row.enabled ? '✅ Enabled' : '❌ Disabled';
          const arrow = row.bidirectional ? '↔' : '→';
          return `${status}\n<#${interaction.channelId}> (${row.source_lang}) ${arrow} <#${row.target_channel_id}> (${row.target_lang})`;
        })
        .join('\n\n');

      await interaction.reply({
        embeds: [EmbedFactory.info('Translation Status', pairs)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error checking translation status', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to check translation status.')],
        ephemeral: true,
      });
    }
  }
}
