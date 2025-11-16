import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  GuildMember,
} from 'discord.js';
import { db } from '../../database/client';
import { logger } from '../../utils/logger';
import { EmbedFactory } from '../../utils/embeds';
import { TTSClient } from '../../services/tts/client';
import { ttsPlayer } from '../../services/tts/player';
import { PermissionManager } from '../../middleware/permissions';
import fs from 'fs';
import path from 'path';

const ttsClient = new TTSClient();

export class TTSCommand {
  data = new SlashCommandBuilder()
    .setName('tts')
    .setDescription('Text-to-Speech commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('register')
        .setDescription('Register a new voice model')
        .addStringOption((option) =>
          option
            .setName('voice-name')
            .setDescription('Name for this voice')
            .setRequired(true)
        )
        .addAttachmentOption((option) =>
          option
            .setName('audio-file')
            .setDescription('Audio sample (6-12 seconds, WAV/MP3/OGG)')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('language')
            .setDescription('Language of the voice')
            .setRequired(false)
            .addChoices(
              { name: 'English', value: 'en' },
              { name: 'Korean', value: 'ko' },
              { name: 'Japanese', value: 'ja' },
              { name: 'Chinese', value: 'zh-cn' },
              { name: 'Spanish', value: 'es' },
              { name: 'French', value: 'fr' },
              { name: 'German', value: 'de' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('select')
        .setDescription('Select a voice to use')
        .addStringOption((option) =>
          option.setName('voice-name').setDescription('Voice to use').setRequired(true)
        )
        .addNumberOption((option) =>
          option
            .setName('speed')
            .setDescription('Speech speed (0.5-2.0, default: 1.0)')
            .setRequired(false)
            .setMinValue(0.5)
            .setMaxValue(2.0)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List your registered voices')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a voice')
        .addStringOption((option) =>
          option.setName('voice-name').setDescription('Voice to delete').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('preview')
        .setDescription('Preview a voice with custom text')
        .addStringOption((option) =>
          option.setName('voice-name').setDescription('Voice to preview').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('text')
            .setDescription('Text to speak')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addNumberOption((option) =>
          option
            .setName('speed')
            .setDescription('Speech speed (0.5-2.0, default: 1.0)')
            .setRequired(false)
            .setMinValue(0.5)
            .setMaxValue(2.0)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set-default')
        .setDescription('Set a voice as your default')
        .addStringOption((option) =>
          option.setName('voice-name').setDescription('Voice to set as default').setRequired(true)
        )
    );

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.data[0].name;

    switch (subcommand) {
      case 'register':
        await this.handleRegister(interaction);
        break;
      case 'select':
        await this.handleSelect(interaction);
        break;
      case 'list':
        await this.handleList(interaction);
        break;
      case 'delete':
        await this.handleDelete(interaction);
        break;
      case 'preview':
        await this.handlePreview(interaction);
        break;
      case 'set-default':
        await this.handleSetDefault(interaction);
        break;
    }
  }

  private async handleRegister(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceName = interaction.options.get('voice-name')?.value as string;
    const attachment = interaction.options.get('audio-file')?.attachment;
    const language = (interaction.options.get('language')?.value as string) || 'en';

    if (!attachment) {
      await interaction.editReply({
        embeds: [EmbedFactory.error('Error', 'No audio file provided.')],
      });
      return;
    }

    try {
      // Download the attachment
      const response = await fetch(attachment.url);
      const buffer = await response.arrayBuffer();
      const tempPath = path.join('/tmp', `voice_${Date.now()}${path.extname(attachment.name)}`);
      fs.writeFileSync(tempPath, Buffer.from(buffer));

      // Register voice with TTS service
      const result = await ttsClient.registerVoice(
        interaction.user.id,
        voiceName,
        tempPath,
        language
      );

      // Save to database
      await db.query(
        `INSERT INTO user_voices (user_id, voice_name, audio_file_path, language, is_default)
         VALUES ($1, $2, $3, $4, false)
         ON CONFLICT (user_id, voice_name)
         DO UPDATE SET audio_file_path = $3, language = $4`,
        [interaction.user.id, voiceName, result.file_path, language]
      );

      // Clean up temp file
      fs.unlinkSync(tempPath);

      await interaction.editReply({
        embeds: [
          EmbedFactory.success(
            'Voice Registered',
            `Voice "${voiceName}" has been registered successfully!\nDuration: ${result.duration.toFixed(1)}s\nLanguage: ${language}`
          ),
        ],
      });
    } catch (error: any) {
      logger.error('Error registering voice', error);
      await interaction.editReply({
        embeds: [
          EmbedFactory.error(
            'Registration Failed',
            error.message || 'Failed to register voice. Please try again.'
          ),
        ],
      });
    }
  }

  private async handleSelect(interaction: ChatInputCommandInteraction) {
    const voiceName = interaction.options.get('voice-name')?.value as string;
    const speed = (interaction.options.get('speed')?.value as number) || 1.0;

    try {
      // Check if voice exists
      const result = await db.query(
        'SELECT id FROM user_voices WHERE user_id = $1 AND voice_name = $2',
        [interaction.user.id, voiceName]
      );

      if (result.rows.length === 0) {
        await interaction.reply({
          embeds: [
            EmbedFactory.error('Not Found', `Voice "${voiceName}" not found in your voices.`),
          ],
          ephemeral: true,
        });
        return;
      }

      // Set as default and update speed
      await db.query('UPDATE user_voices SET is_default = false WHERE user_id = $1', [
        interaction.user.id,
      ]);

      await db.query(
        'UPDATE user_voices SET is_default = true, speed = $3 WHERE user_id = $1 AND voice_name = $2',
        [interaction.user.id, voiceName, speed]
      );

      await interaction.reply({
        embeds: [
          EmbedFactory.success(
            'Voice Selected',
            `Now using voice: "${voiceName}"\nSpeed: ${speed}x`
          ),
        ],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error selecting voice', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to select voice.')],
        ephemeral: true,
      });
    }
  }

  private async handleList(interaction: ChatInputCommandInteraction) {
    try {
      const voices = await ttsClient.listVoices(interaction.user.id);

      if (voices.length === 0) {
        await interaction.reply({
          embeds: [
            EmbedFactory.info(
              'Your Voices',
              'You have not registered any voices yet.\nUse `/tts register` to add a voice.'
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      // Get default voice from database
      const dbResult = await db.query(
        'SELECT voice_name, is_default FROM user_voices WHERE user_id = $1',
        [interaction.user.id]
      );

      const defaultVoice = dbResult.rows.find((row) => row.is_default)?.voice_name;

      const description = voices
        .map((voice) => {
          const isDefault = voice.name === defaultVoice ? '⭐ ' : '';
          return `${isDefault}**${voice.name}** - ${voice.duration.toFixed(1)}s`;
        })
        .join('\n');

      await interaction.reply({
        embeds: [EmbedFactory.info('Your Voices', description)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error listing voices', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to list voices.')],
        ephemeral: true,
      });
    }
  }

  private async handleDelete(interaction: ChatInputCommandInteraction) {
    const voiceName = interaction.options.get('voice-name')?.value as string;

    try {
      // Delete from TTS service
      await ttsClient.deleteVoice(interaction.user.id, voiceName);

      // Delete from database
      const result = await db.query(
        'DELETE FROM user_voices WHERE user_id = $1 AND voice_name = $2 RETURNING *',
        [interaction.user.id, voiceName]
      );

      if (result.rowCount === 0) {
        await interaction.reply({
          embeds: [EmbedFactory.error('Not Found', `Voice "${voiceName}" not found.`)],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [EmbedFactory.success('Voice Deleted', `Voice "${voiceName}" has been deleted.`)],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error deleting voice', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to delete voice.')],
        ephemeral: true,
      });
    }
  }

  private async handlePreview(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceName = interaction.options.get('voice-name')?.value as string;
    const text = interaction.options.get('text')?.value as string;
    const speed = (interaction.options.get('speed')?.value as number) || 1.0;

    try {
      // Get voice language from database
      const dbResult = await db.query(
        'SELECT language FROM user_voices WHERE user_id = $1 AND voice_name = $2',
        [interaction.user.id, voiceName]
      );

      if (dbResult.rows.length === 0) {
        await interaction.editReply({
          embeds: [EmbedFactory.error('Not Found', `Voice "${voiceName}" not found.`)],
        });
        return;
      }

      const language = dbResult.rows[0].language || 'en';

      // Synthesize speech with speed
      const audioBuffer = await ttsClient.synthesize(
        interaction.user.id,
        text,
        voiceName,
        language,
        speed
      );

      // Send as attachment
      const attachment = new AttachmentBuilder(audioBuffer, { name: 'preview.wav' });

      await interaction.editReply({
        embeds: [
          EmbedFactory.success(
            'Preview Generated',
            `Voice: ${voiceName}\nSpeed: ${speed}x\nText: "${text}"`
          ),
        ],
        files: [attachment],
      });
    } catch (error: any) {
      logger.error('Error previewing voice', error);
      await interaction.editReply({
        embeds: [
          EmbedFactory.error('Preview Failed', error.message || 'Failed to generate preview.'),
        ],
      });
    }
  }

  private async handleSetDefault(interaction: ChatInputCommandInteraction) {
    const voiceName = interaction.options.get('voice-name')?.value as string;

    try {
      // Check if voice exists
      const checkResult = await db.query(
        'SELECT id FROM user_voices WHERE user_id = $1 AND voice_name = $2',
        [interaction.user.id, voiceName]
      );

      if (checkResult.rows.length === 0) {
        await interaction.reply({
          embeds: [EmbedFactory.error('Not Found', `Voice "${voiceName}" not found.`)],
          ephemeral: true,
        });
        return;
      }

      // Set as default
      await db.query('UPDATE user_voices SET is_default = false WHERE user_id = $1', [
        interaction.user.id,
      ]);

      await db.query(
        'UPDATE user_voices SET is_default = true WHERE user_id = $1 AND voice_name = $2',
        [interaction.user.id, voiceName]
      );

      await interaction.reply({
        embeds: [
          EmbedFactory.success('Default Voice Set', `"${voiceName}" is now your default voice.`),
        ],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error setting default voice', error);
      await interaction.reply({
        embeds: [EmbedFactory.error('Error', 'Failed to set default voice.')],
        ephemeral: true,
      });
    }
  }
}
