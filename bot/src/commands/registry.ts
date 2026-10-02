import { REST, Routes, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
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
 * Remove any global commands left over from the old `deploy-commands` script.
 * Without this, every command would show up twice (global + guild) in the Discord menu.
 */
export async function clearGlobalCommands(): Promise<void> {
  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: [] });
}
