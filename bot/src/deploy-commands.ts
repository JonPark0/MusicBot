import { REST, Routes } from 'discord.js';
import { config } from './config/constants';
import { logger } from './utils/logger';

// Import commands
import { MusicAdminCommand } from './commands/admin/music-admin';
import { MusicCommand } from './commands/user/music';

const commands = [
  new MusicAdminCommand().data.toJSON(),
  new MusicCommand().data.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands }
    ) as any[];

    logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    logger.error('Error deploying commands', error);
  }
})();
