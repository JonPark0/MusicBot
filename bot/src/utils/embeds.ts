import { EmbedBuilder, User, ColorResolvable } from 'discord.js';

export class EmbedFactory {
  /**
   * Create a standard info embed
   */
  static info(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Create a success embed
   */
  static success(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`✅ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Create an error embed
   */
  static error(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`❌ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Create a warning embed
   */
  static warning(title: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`⚠️ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  /**
   * Create a translated message embed
   */
  static translatedMessage(
    user: User,
    translatedText: string,
    originalText: string,
    sourceLang: string,
    targetLang: string
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setAuthor({
        name: user.username,
        iconURL: user.displayAvatarURL(),
      })
      .setDescription(translatedText)
      .setColor(0x5865F2)
      .setFooter({
        text: `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()} | Original: ${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}`,
      })
      .setTimestamp();
  }

  /**
   * Create a now playing embed for music
   */
  static nowPlaying(
    title: string,
    url: string,
    platform: string,
    duration: number,
    requestedBy: User
  ): EmbedBuilder {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${title}](${url})**`)
      .addFields(
        { name: 'Platform', value: platform.toUpperCase(), inline: true },
        { name: 'Duration', value: durationStr, inline: true },
        { name: 'Requested by', value: requestedBy.username, inline: true }
      )
      .setTimestamp();
  }

  /**
   * Create a queue embed for music
   */
  static queue(
    tracks: Array<{ title: string; duration: number; requestedBy: string }>,
    currentPage: number,
    totalPages: number
  ): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎵 Music Queue')
      .setFooter({ text: `Page ${currentPage}/${totalPages}` })
      .setTimestamp();

    if (tracks.length === 0) {
      embed.setDescription('Queue is empty');
    } else {
      const description = tracks
        .map((track, index) => {
          const minutes = Math.floor(track.duration / 60);
          const seconds = track.duration % 60;
          const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          return `**${index + 1}.** ${track.title} \`[${durationStr}]\` - ${track.requestedBy}`;
        })
        .join('\n');
      embed.setDescription(description);
    }

    return embed;
  }
}
