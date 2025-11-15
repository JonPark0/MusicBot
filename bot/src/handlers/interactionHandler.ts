import { Client, Collection, CommandInteraction, Interaction } from 'discord.js';
import { logger } from '../utils/logger';
import { EmbedFactory } from '../utils/embeds';

export interface Command {
  data: any;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export class InteractionHandler {
  private commands: Collection<string, Command>;

  constructor() {
    this.commands = new Collection();
  }

  registerCommand(command: Command) {
    this.commands.set(command.data.name, command);
    logger.info(`Registered command: ${command.data.name}`);
  }

  async handleInteraction(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = this.commands.get(interaction.commandName);

    if (!command) {
      logger.warn(`Unknown command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
      logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error(`Error executing command: ${interaction.commandName}`, error);

      const errorEmbed = EmbedFactory.error(
        'Command Error',
        'An error occurred while executing this command. Please try again later.'
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }

  getCommands() {
    return this.commands;
  }
}
