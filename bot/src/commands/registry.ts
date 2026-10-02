import {
  APIApplicationCommand,
  ApplicationCommandType,
  REST,
  Routes,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import { config } from '../config/constants';

// Slash commands are registered per guild on startup and when the bot joins a guild,
// because guild command updates show up in Discord immediately (global ones can lag).

const rest = new REST({ version: '10' }).setToken(config.discord.token);

/** Overwrite the command set of one guild. */
export async function syncGuildCommands(
  guildId: string,
  body: RESTPostAPIApplicationCommandsJSONBody[]
): Promise<void> {
  await rest.put(Routes.applicationGuildCommands(config.discord.clientId, guildId), { body });
}

/**
 * Remove global commands left over from the old `deploy-commands` script.
 * Without this, every command would show up twice (global + guild) in the Discord menu.
 *
 * Commands are deleted one by one instead of a bulk overwrite with `[]`, because an app with
 * Activities enabled has an Entry Point ("Launch") command that a bulk overwrite can't remove
 * (Discord error 50240). That command is left alone. Returns the number of commands removed.
 */
export async function clearGlobalCommands(): Promise<number> {
  const existing = (await rest.get(
    Routes.applicationCommands(config.discord.clientId)
  )) as APIApplicationCommand[];
  const stale = existing.filter((command) => command.type !== ApplicationCommandType.PrimaryEntryPoint);
  for (const command of stale) {
    await rest.delete(Routes.applicationCommand(config.discord.clientId, command.id));
  }
  return stale.length;
}
