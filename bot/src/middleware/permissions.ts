import { ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { db } from '../database/client';
import { logger } from '../utils/logger';

export class PermissionManager {
  /**
   * Check if user has admin permissions
   */
  static async hasAdminPermission(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (!interaction.guild || !interaction.member) {
      return false;
    }

    const member = interaction.member as GuildMember;

    // 1. Check if user is server owner
    if (interaction.guild.ownerId === member.user.id) {
      return true;
    }

    // 2. Check if user has Administrator permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    // 3. Check custom permissions from database
    try {
      const result = await db.query(
        'SELECT required_role_ids FROM command_permissions WHERE guild_id = $1 AND command_name = $2',
        [interaction.guildId, interaction.commandName]
      );

      if (result.rows.length > 0) {
        const requiredRoles: string[] = result.rows[0].required_role_ids || [];
        const memberRoles = member.roles.cache.map((r) => r.id);
        return requiredRoles.some((roleId) => memberRoles.includes(roleId));
      }
    } catch (error) {
      logger.error('Error checking custom permissions', error);
    }

    return false;
  }

  /**
   * Check if channel is enabled for translation
   */
  static async isTranslationChannel(guildId: string, channelId: string): Promise<boolean> {
    try {
      const result = await db.query(
        `SELECT id FROM translation_channels
         WHERE guild_id = $1
         AND (source_channel_id = $2 OR target_channel_id = $2)
         AND enabled = true`,
        [guildId, channelId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking translation channel', error);
      return false;
    }
  }

  /**
   * Check if channel is enabled for TTS
   */
  static async isTTSChannel(guildId: string, channelId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT id FROM tts_channels WHERE guild_id = $1 AND channel_id = $2 AND enabled = true',
        [guildId, channelId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking TTS channel', error);
      return false;
    }
  }

  /**
   * Check if channel is enabled for music
   */
  static async isMusicChannel(guildId: string, channelId: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT id FROM music_channels WHERE guild_id = $1 AND channel_id = $2 AND enabled = true',
        [guildId, channelId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking music channel', error);
      return false;
    }
  }

  /**
   * Check if user is in a voice channel
   */
  static isInVoiceChannel(interaction: ChatInputCommandInteraction): boolean {
    const member = interaction.member as GuildMember;
    return member?.voice?.channel !== null && member?.voice?.channel !== undefined;
  }
}
