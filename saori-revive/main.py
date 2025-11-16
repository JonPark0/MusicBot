import discord
from discord import app_commands
import asyncio
import logging
import json
import signal
from music_cog import Music
from help_cog import Help
from lavalink_client import LavalinkClient

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('music_bot')

def load_config():
    try:
        with open('config.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("config.json file not found!")
        raise
    except json.JSONDecodeError:
        logger.error("Invalid JSON in config.json!")
        raise

config = load_config()
BOT_TOKEN = config['bot_token']
DEBUG_MODE = config.get('debug', False)

def debug_log(message):
    """Debug logging function"""
    if DEBUG_MODE:
        logger.info(f"[DEBUG] {message}")

def load_guild_config(guild_id):
    try:
        with open(f'config_{guild_id}.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"timeout": 300, "max_queue_size": 100}

def save_guild_config(guild_id, config):
    with open(f'config_{guild_id}.json', 'w') as f:
        json.dump(config, f)

class MusicBot(discord.Client):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True  # CRUCIAL: Enable voice state events
        intents.guilds = True        # Needed for voice events
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)
        self.guild_configs = {}
        self.lavalink_client = None

    def get_guild_config(self, guild_id):
        if guild_id not in self.guild_configs:
            self.guild_configs[guild_id] = load_guild_config(guild_id)
        return self.guild_configs[guild_id]

    async def setup_hook(self):
        debug_log("Starting setup_hook")
        
        # Initialize Lavalink client
        debug_log("Initializing Lavalink client")
        self.lavalink_client = LavalinkClient(self, config)
        await self.lavalink_client.initialize()
        debug_log("Lavalink client initialized")
        
        # Load guild configs
        debug_log(f"Loading configs for {len(self.guilds)} guilds")
        for guild in self.guilds:
            self.get_guild_config(guild.id)
            debug_log(f"Loaded config for guild {guild.id}")
        
        # Initialize Cogs
        debug_log("Initializing Music cog")
        # Pass config to Music cog
        self.config = config
        self.music_cog = Music(self)
        debug_log("Initializing Help cog")
        self.help_cog = Help(self)
        
        # Add commands to tree
        debug_log("Syncing command tree")
        try:
            # Clear any existing commands first to avoid conflicts
            debug_log("Clearing existing commands")
            self.tree.clear_commands(guild=None)
            debug_log(f"Commands cleared. Current tree commands: {len(self.tree.get_commands())}")
            
            # Re-add commands
            debug_log("Re-adding commands after clear")
            for command in self.music_cog.commands:
                try:
                    self.tree.add_command(command)
                    debug_log(f"Successfully added command: {command.name}")
                except Exception as e:
                    debug_log(f"Failed to add command {command.name}: {str(e)}")
                    
            for command in self.help_cog.commands:
                try:
                    self.tree.add_command(command)
                    debug_log(f"Successfully added command: {command.name}")
                except Exception as e:
                    debug_log(f"Failed to add command {command.name}: {str(e)}")
            
            # Sync commands globally
            synced = await self.tree.sync()
            logger.info(f"Synced {len(synced)} application commands globally")
            debug_log(f"Synced commands: {[cmd.name for cmd in synced]}")
            
            # Also sync for current guilds to ensure immediate availability
            debug_log("Syncing commands for existing guilds")
            for guild in self.guilds:
                try:
                    guild_synced = await self.tree.sync(guild=guild)
                    debug_log(f"Synced {len(guild_synced)} commands for guild {guild.name}")
                except Exception as guild_error:
                    debug_log(f"Failed to sync for guild {guild.name}: {str(guild_error)}")
                    
        except Exception as e:
            logger.error(f"Failed to sync commands: {str(e)}")
            debug_log(f"Command sync error: {str(e)}")
        debug_log("Setup hook completed")

    async def on_guild_join(self, guild):
        self.get_guild_config(guild.id)
        await self.tree.sync(guild=guild)
        logger.info(f"Joined new guild: {guild.id}. Commands synced.")

    async def on_ready(self):
        debug_log("Bot ready event triggered")
        if self.user:
            logger.info(f'Logged in as {self.user.name}')
            logger.info(f'Bot is in {len(self.guilds)} guilds')
            debug_log(f"User: {self.user.name} (ID: {self.user.id})")
            debug_log(f"Guilds: {[guild.name for guild in self.guilds]}")
        debug_log("Bot is fully ready")

    async def on_voice_state_update(self, member, before, after):
        """Handle voice state updates for Lavalink"""
        if self.user and member.id == self.user.id:
            if before.channel != after.channel:
                if self.lavalink_client and self.lavalink_client.client:
                    player = self.lavalink_client.get_player(member.guild.id)
                    
                    if after.channel is None:
                        # Bot was disconnected
                        debug_log(f"Bot disconnected from voice channel in guild {member.guild.id}")
                        if player and hasattr(player, 'stop'):
                            await player.stop()  # type: ignore
                    else:
                        # Bot was moved to a different channel or connected
                        debug_log(f"Bot voice state changed in guild {member.guild.id}: {after.channel.name if after.channel else 'None'}")
                        # Voice events will be handled by the VoiceProtocol

    async def on_socket_response(self, msg):
        """Log socket responses - VoiceProtocol handles voice events"""
        debug_log(f"Socket response received: {msg.get('t', 'Unknown')}")
        
        # Voice events are now handled by LavalinkVoiceClient
        if msg.get('t') in ['VOICE_STATE_UPDATE', 'VOICE_SERVER_UPDATE']:
            debug_log(f"Voice socket event: {msg.get('t')} - handled by VoiceProtocol")
        else:
            debug_log(f"Non-voice socket event: {msg.get('t', 'Unknown')}")

    async def close(self):
        """Cleanup on bot shutdown"""
        debug_log("Bot close() called - starting cleanup")
        
        try:
            # Disconnect from all voice channels
            debug_log("Disconnecting from all voice channels")
            for guild in self.guilds:
                if guild.voice_client:
                    debug_log(f"Disconnecting from voice channel in guild {guild.name}")
                    try:
                        await guild.voice_client.disconnect(force=True)
                    except Exception as e:
                        debug_log(f"Error disconnecting from guild {guild.name}: {str(e)}")
            
            # Clean up Lavalink client
            if self.lavalink_client:
                debug_log("Destroying Lavalink client")
                await self.lavalink_client.destroy()
                debug_log("Lavalink client destroyed")
            
            # Save any pending configurations  
            if hasattr(self, 'guild_settings') and getattr(self, 'guild_settings', None):
                debug_log(f"Saving guild settings for {len(self.guild_settings)} guilds")
                # Here you could save guild settings to a file if needed
            
            debug_log("Bot cleanup completed successfully")
            
        except Exception as e:
            debug_log(f"Error during bot cleanup: {str(e)}")
            logger.error(f"Error during bot cleanup: {str(e)}")
        
        finally:
            await super().close()
    
    async def graceful_shutdown(self):
        """Perform graceful shutdown"""
        debug_log("Starting graceful shutdown")
        logger.info("Initiating graceful shutdown...")
        
        try:
            # Close the bot properly
            await self.close()
            debug_log("Graceful shutdown completed")
            logger.info("Graceful shutdown completed")
        except Exception as e:
            debug_log(f"Error during graceful shutdown: {str(e)}")
            logger.error(f"Error during graceful shutdown: {str(e)}")

bot = MusicBot()

@bot.tree.command(name="set_timeout", description="Set the timeout for the music player")
@app_commands.describe(timeout="Timeout in seconds (minimum 60, maximum 3600)")
async def set_timeout(interaction: discord.Interaction, timeout: int):
    if not interaction.guild:
        await interaction.response.send_message("This command can only be used in a guild.", ephemeral=True)
        return
    
    # Check if user is a Member (not just User) and has permissions
    member = interaction.guild.get_member(interaction.user.id)
    if not member or not member.guild_permissions.manage_guild:
        await interaction.response.send_message("You don't have permission to use this command.", ephemeral=True)
        return

    if timeout < 60 or timeout > 3600:
        await interaction.response.send_message("Timeout must be between 60 and 3600 seconds.", ephemeral=True)
        return

    config = bot.get_guild_config(interaction.guild_id)
    config["timeout"] = timeout
    save_guild_config(interaction.guild_id, config)
    await interaction.response.send_message(f"Timeout set to {timeout} seconds.", ephemeral=True)

@bot.tree.command(name="set_max_queue", description="Set the maximum queue size")
@app_commands.describe(size="Maximum number of songs in queue (minimum 1, maximum 1000)")
async def set_max_queue(interaction: discord.Interaction, size: int):
    if not interaction.guild:
        await interaction.response.send_message("This command can only be used in a guild.", ephemeral=True)
        return
    
    # Check if user is a Member (not just User) and has permissions
    member = interaction.guild.get_member(interaction.user.id)
    if not member or not member.guild_permissions.manage_guild:
        await interaction.response.send_message("You don't have permission to use this command.", ephemeral=True)
        return

    if size < 1 or size > 1000:
        await interaction.response.send_message("Maximum queue size must be between 1 and 1000.", ephemeral=True)
        return

    config = bot.get_guild_config(interaction.guild_id)
    config["max_queue_size"] = size
    save_guild_config(interaction.guild_id, config)
    await interaction.response.send_message(f"Maximum queue size set to {size}.", ephemeral=True)

# Global shutdown event
shutdown_event = asyncio.Event()

def signal_handler(signum, _):
    """Handle OS signals for graceful shutdown"""
    signal_name = signal.Signals(signum).name
    debug_log(f"Received signal {signal_name} ({signum})")
    logger.info(f"Received signal {signal_name} - initiating shutdown")
    
    # Set the shutdown event to trigger graceful shutdown
    if not shutdown_event.is_set():
        shutdown_event.set()

async def setup_signal_handlers():
    """Setup signal handlers for graceful shutdown"""
    try:
        # Unix/Linux signal handling
        debug_log("Setting up Unix/Linux signal handlers")
        loop = asyncio.get_running_loop()
        
        # Handle SIGTERM (kill command)
        loop.add_signal_handler(signal.SIGTERM, signal_handler, signal.SIGTERM, None)
        debug_log("SIGTERM handler registered")
        
        # Handle SIGINT (Ctrl+C)
        loop.add_signal_handler(signal.SIGINT, signal_handler, signal.SIGINT, None)
        debug_log("SIGINT handler registered")
        
        # Handle SIGHUP (terminal disconnect)
        loop.add_signal_handler(signal.SIGHUP, signal_handler, signal.SIGHUP, None)
        debug_log("SIGHUP handler registered")
        
    except NotImplementedError:
        # Windows or other platforms that don't support add_signal_handler
        debug_log("Setting up fallback signal handlers")
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        debug_log("Fallback signal handlers registered")

async def main():
    """Main function with graceful shutdown handling"""
    debug_log("Starting main function")
    
    try:
        # Setup signal handlers
        await setup_signal_handlers()
        debug_log("Signal handlers setup completed")
        
        # Start the bot
        try:
            async with bot:
                debug_log("Starting bot with graceful shutdown support")
                logger.info("Bot starting up...")
                
                # Create bot start task
                bot_task = asyncio.create_task(bot.start(BOT_TOKEN))
                debug_log("Bot start task created")
                
                # Create shutdown monitoring task
                async def shutdown_monitor():
                    debug_log("Shutdown monitor started")
                    await shutdown_event.wait()
                    debug_log("Shutdown event received in monitor")
                    logger.info("Shutdown signal received - stopping bot")
                    
                    # Cancel the bot task
                    if not bot_task.done():
                        debug_log("Cancelling bot task")
                        bot_task.cancel()
                    
                    # Perform graceful shutdown
                    await bot.graceful_shutdown()
                    debug_log("Graceful shutdown completed in monitor")
                
                shutdown_task = asyncio.create_task(shutdown_monitor())
                debug_log("Shutdown monitor task created")
                
                # Wait for either bot completion or shutdown signal
                try:
                    done, pending = await asyncio.wait(
                        [bot_task, shutdown_task],
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    debug_log(f"Main wait completed - done: {len(done)}, pending: {len(pending)}")
                    
                    # Cancel any remaining tasks
                    for task in pending:
                        debug_log(f"Cancelling pending task: {task}")
                        task.cancel()
                        try:
                            await task
                        except asyncio.CancelledError:
                            debug_log("Pending task cancelled successfully")
                    
                except asyncio.CancelledError:
                    debug_log("Main tasks cancelled")
                    logger.info("Bot tasks cancelled")
                except discord.errors.LoginFailure:
                    debug_log("Discord login failure")
                    logger.error("Failed to login. Please check your bot token.")
                except Exception as e:
                    debug_log(f"Unexpected error in main: {str(e)}")
                    logger.exception(f"An unexpected error occurred: {e}")
                    
        except asyncio.CancelledError:
            debug_log("Bot context cancelled - this is normal during shutdown")
            logger.info("Bot context cancelled during shutdown")
        except Exception as e:
            debug_log(f"Error in bot context: {str(e)}")
            logger.exception(f"Error in bot context: {e}")
                
    except KeyboardInterrupt:
        debug_log("KeyboardInterrupt received in main")
        logger.info("Keyboard interrupt received")
        if not shutdown_event.is_set():
            shutdown_event.set()
    except Exception as e:
        debug_log(f"Fatal error in main: {str(e)}")
        logger.exception(f"Fatal error: {e}")
    finally:
        debug_log("Main function cleanup")
        logger.info("Bot shutdown process completed")

if __name__ == "__main__":
    try:
        debug_log("Starting application")
        asyncio.run(main())
        debug_log("Application ended normally")
    except KeyboardInterrupt:
        debug_log("KeyboardInterrupt at top level")
        logger.info("Application interrupted by user")
    except Exception as e:
        debug_log(f"Top-level exception: {str(e)}")
        logger.exception(f"Top-level exception: {e}")
    finally:
        debug_log("Application shutdown complete")
        logger.info("Application shutdown complete")