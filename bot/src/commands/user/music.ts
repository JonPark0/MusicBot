import { SlashCommandBuilder, CommandInteraction, GuildMember, VoiceChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { EmbedFactory } from '../../utils/embeds';
import { getMusicPlayer } from '../../services/music/player';
import { LoopMode } from '../../services/music/queue';
import { PermissionManager } from '../../middleware/permissions';

export class MusicCommand {
  data = new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music playback commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('Play a track or playlist')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('YouTube/Spotify/SoundCloud URL or search query')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('pause').setDescription('Pause current track')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('resume').setDescription('Resume playback')
    )
    .addSubcommand((subcommand) => subcommand.setName('skip').setDescription('Skip current track'))
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('Stop playback and clear queue')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('queue')
        .setDescription('Show current queue')
        .addIntegerOption((option) =>
          option
            .setName('page')
            .setDescription('Page number')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('nowplaying').setDescription('Show currently playing track')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('volume')
        .setDescription('Set volume')
        .addIntegerOption((option) =>
          option
            .setName('level')
            .setDescription('Volume level (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('shuffle').setDescription('Shuffle the queue')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('loop')
        .setDescription('Set loop mode')
        .addStringOption((option) =>
          option
            .setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
              { name: 'Off', value: 'off' },
              { name: 'Track', value: 'track' },
              { name: 'Queue', value: 'queue' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a track from queue')
        .addIntegerOption((option) =>
          option
            .setName('position')
            .setDescription('Track position in queue')
            .setRequired(true)
            .setMinValue(1)
        )
    );

  async execute(interaction: CommandInteraction) {
    const subcommand = interaction.options.data[0].name;

    // Check if user is in voice channel (except for queue and nowplaying)
    if (!['queue', 'nowplaying'].includes(subcommand)) {
      if (!PermissionManager.isInVoiceChannel(interaction)) {
        await interaction.reply({
          embeds: [
            EmbedFactory.error(
              'Not in Voice Channel',
              'You must be in a voice channel to use this command.'
            ),
          ],
          ephemeral: true,
        });
        return;
      }
    }

    switch (subcommand) {
      case 'play':
        await this.handlePlay(interaction);
        break;
      case 'pause':
        await this.handlePause(interaction);
        break;
      case 'resume':
        await this.handleResume(interaction);
        break;
      case 'skip':
        await this.handleSkip(interaction);
        break;
      case 'stop':
        await this.handleStop(interaction);
        break;
      case 'queue':
        await this.handleQueue(interaction);
        break;
      case 'nowplaying':
        await this.handleNowPlaying(interaction);
        break;
      case 'volume':
        await this.handleVolume(interaction);
        break;
      case 'shuffle':
        await this.handleShuffle(interaction);
        break;
      case 'loop':
        await this.handleLoop(interaction);
        break;
      case 'remove':
        await this.handleRemove(interaction);
        break;
    }
  }

  private async handlePlay(interaction: CommandInteraction) {
    await interaction.deferReply();

    const query = interaction.options.get('url')?.value as string;
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel as VoiceChannel;

    if (!voiceChannel) {
      await interaction.editReply({
        embeds: [
          EmbedFactory.error(
            'Not in Voice Channel',
            'You must be in a voice channel to play music.'
          ),
        ],
      });
      return;
    }

    try {
      const musicPlayer = getMusicPlayer();
      const result = await musicPlayer.play(voiceChannel, query, member);

      if (!result) {
        await interaction.editReply({
          embeds: [
            EmbedFactory.error(
              'Track Not Found',
              'Could not find or load the requested track.'
            ),
          ],
        });
        return;
      }

      // Check if result is an array (playlist) or single track
      if (Array.isArray(result)) {
        // Playlist
        await interaction.editReply({
          embeds: [
            EmbedFactory.success(
              'Playlist Added',
              `Added ${result.length} tracks to the queue.`
            ),
          ],
        });
      } else {
        // Single track
        const queueSize = musicPlayer.getQueueSize(interaction.guildId!);

        if (queueSize > 0) {
          await interaction.editReply({
            embeds: [
              EmbedFactory.success(
                'Track Added to Queue',
                `**${result.title}**\nPosition in queue: ${queueSize + 1}`
              ),
            ],
          });
        } else {
          await interaction.editReply({
            embeds: [
              EmbedFactory.nowPlaying(
                result.title,
                result.url,
                result.platform,
                result.duration,
                interaction.user
              ),
            ],
          });
        }
      }
    } catch (error: any) {
      logger.error('Error playing music', error);
      await interaction.editReply({
        embeds: [
          EmbedFactory.error('Playback Error', error.message || 'Failed to play the track.'),
        ],
      });
    }
  }

  private async handlePause(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    const paused = musicPlayer.pause(interaction.guildId!);

    if (paused) {
      await interaction.reply({
        embeds: [EmbedFactory.success('Paused', 'Playback paused.')],
      });
    } else {
      await interaction.reply({
        embeds: [EmbedFactory.error('Not Playing', 'Nothing is currently playing.')],
        ephemeral: true,
      });
    }
  }

  private async handleResume(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    const resumed = musicPlayer.resume(interaction.guildId!);

    if (resumed) {
      await interaction.reply({
        embeds: [EmbedFactory.success('Resumed', 'Playback resumed.')],
      });
    } else {
      await interaction.reply({
        embeds: [EmbedFactory.error('Not Paused', 'Playback is not paused.')],
        ephemeral: true,
      });
    }
  }

  private async handleSkip(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    const queueSize = musicPlayer.getQueueSize(interaction.guildId!);

    if (queueSize === 0 && !musicPlayer.isPlaying(interaction.guildId!)) {
      await interaction.reply({
        embeds: [EmbedFactory.error('Queue Empty', 'No tracks in the queue.')],
        ephemeral: true,
      });
      return;
    }

    await musicPlayer.skip(interaction.guildId!);

    await interaction.reply({
      embeds: [EmbedFactory.success('Skipped', 'Skipped to the next track.')],
    });
  }

  private async handleStop(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    musicPlayer.stop(interaction.guildId!);

    await interaction.reply({
      embeds: [EmbedFactory.success('Stopped', 'Playback stopped and queue cleared.')],
    });
  }

  private async handleQueue(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    const queueSize = musicPlayer.getQueueSize(interaction.guildId!);

    if (queueSize === 0) {
      await interaction.reply({
        embeds: [EmbedFactory.info('Queue', 'Queue is empty.')],
        ephemeral: true,
      });
      return;
    }

    const page = (interaction.options.get('page')?.value as number) || 1;
    const { tracks, totalPages } = musicPlayer.getPaginatedTracks(interaction.guildId!, page, 10);

    const embed = EmbedFactory.queue(
      tracks.map((track, index) => ({
        title: track.title,
        duration: track.duration,
        requestedBy: track.requestedBy ? `<@${track.requestedBy}>` : 'Unknown',
      })),
      page,
      totalPages
    );

    // Add queue info to embed
    const totalDuration = musicPlayer.getQueueDuration(interaction.guildId!);
    const hours = Math.floor(totalDuration / 3600);
    const minutes = Math.floor((totalDuration % 3600) / 60);
    const loopMode = musicPlayer.getLoopMode(interaction.guildId!);

    embed.addFields({
      name: 'Queue Info',
      value: `Total tracks: ${queueSize}\nTotal duration: ${hours}h ${minutes}m\nLoop: ${loopMode}`,
    });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  }

  private async handleNowPlaying(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    const track = musicPlayer.getNowPlaying(interaction.guildId!);

    if (!track) {
      await interaction.reply({
        embeds: [EmbedFactory.info('Now Playing', 'Nothing is currently playing.')],
        ephemeral: true,
      });
      return;
    }

    const volume = musicPlayer.getVolume(interaction.guildId!);

    const embed = EmbedFactory.nowPlaying(
      track.title,
      track.url,
      track.platform,
      track.duration,
      track.requestedBy ? await interaction.client.users.fetch(track.requestedBy) : interaction.user
    );

    embed.addFields({ name: 'Volume', value: `${volume}%`, inline: true });

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    await interaction.reply({
      embeds: [embed],
    });
  }

  private async handleVolume(interaction: CommandInteraction) {
    const level = interaction.options.get('level')?.value as number;
    const musicPlayer = getMusicPlayer();

    musicPlayer.setVolume(interaction.guildId!, level);

    await interaction.reply({
      embeds: [EmbedFactory.success('Volume Set', `Volume set to ${level}%`)],
    });
  }

  private async handleShuffle(interaction: CommandInteraction) {
    const musicPlayer = getMusicPlayer();
    const queueSize = musicPlayer.getQueueSize(interaction.guildId!);

    if (queueSize === 0) {
      await interaction.reply({
        embeds: [EmbedFactory.error('Queue Empty', 'Nothing to shuffle.')],
        ephemeral: true,
      });
      return;
    }

    musicPlayer.shuffle(interaction.guildId!);

    await interaction.reply({
      embeds: [EmbedFactory.success('Shuffled', 'Queue has been shuffled.')],
    });
  }

  private async handleLoop(interaction: CommandInteraction) {
    const mode = interaction.options.get('mode')?.value as string;
    const musicPlayer = getMusicPlayer();

    if (!musicPlayer.isPlaying(interaction.guildId!)) {
      await interaction.reply({
        embeds: [EmbedFactory.error('Not Playing', 'Nothing is currently playing.')],
        ephemeral: true,
      });
      return;
    }

    const loopMode = mode as LoopMode;
    musicPlayer.setLoopMode(interaction.guildId!, loopMode);

    const modeText = {
      [LoopMode.OFF]: 'Off',
      [LoopMode.TRACK]: 'Track',
      [LoopMode.QUEUE]: 'Queue',
    };

    await interaction.reply({
      embeds: [EmbedFactory.success('Loop Mode', `Loop mode set to: ${modeText[loopMode]}`)],
    });
  }

  private async handleRemove(interaction: CommandInteraction) {
    const position = interaction.options.get('position')?.value as number;
    const musicPlayer = getMusicPlayer();

    const queueSize = musicPlayer.getQueueSize(interaction.guildId!);

    if (queueSize === 0) {
      await interaction.reply({
        embeds: [EmbedFactory.error('Queue Empty', 'Queue is empty.')],
        ephemeral: true,
      });
      return;
    }

    const removed = musicPlayer.removeTrack(interaction.guildId!, position);

    if (!removed) {
      await interaction.reply({
        embeds: [EmbedFactory.error('Invalid Position', 'No track at that position.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [EmbedFactory.success('Track Removed', `Removed track at position ${position}`)],
    });
  }
}
