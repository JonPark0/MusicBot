import lavalink
import logging
import discord

logger = logging.getLogger('music_bot.lavalink_client')

def debug_log(message):
    """Debug logging function - will be set by main.py"""
    pass

class LavalinkVoiceClient(discord.VoiceProtocol):
    """Custom voice client for Lavalink"""
    
    def __init__(self, client, channel):
        self.client = client
        self.channel = channel
        self.lavalink = client.lavalink_client.client
        self._guild_id = channel.guild.id
        self._session_id = None
        self._voice_server_data = None
        debug_log(f"LavalinkVoiceClient created for channel {channel.id}")
        
    async def on_voice_server_update(self, data):
        """Handle voice server updates"""
        debug_log(f"VoiceClient - Voice server update: {data}")
        # Transform data for Lavalink using official format
        lavalink_data = {
            't': 'VOICE_SERVER_UPDATE',
            'd': data
        }
        debug_log(f"Forwarding voice server update to Lavalink: {lavalink_data}")
        await self.lavalink.voice_update_handler(lavalink_data)
            
    async def on_voice_state_update(self, data):
        """Handle voice state updates"""
        debug_log(f"VoiceClient - Voice state update: {data}")
        channel_id = data.get('channel_id')
        
        if not channel_id:
            debug_log("No channel_id in voice state update - destroying connection")
            return
            
        # Transform data for Lavalink using official format
        lavalink_data = {
            't': 'VOICE_STATE_UPDATE',
            'd': data
        }
        debug_log(f"Forwarding voice state update to Lavalink: {lavalink_data}")
        await self.lavalink.voice_update_handler(lavalink_data)
            
    async def connect(self, *, timeout=60.0, reconnect=True, self_deaf=False, self_mute=False):
        """Connect to voice channel"""
        debug_log(f"LavalinkVoiceClient connecting to channel {self.channel.id}")
        # Actually connect to Discord voice to trigger voice events
        await self.channel.guild.change_voice_state(
            channel=self.channel,
            self_mute=self_mute,
            self_deaf=self_deaf
        )
        debug_log("Discord voice state change requested")
        
    async def disconnect(self, *, force=False):
        """Disconnect from voice channel"""
        debug_log(f"LavalinkVoiceClient disconnecting from channel {self.channel.id}")
        await self.channel.guild.change_voice_state(channel=None)
        debug_log("Discord voice disconnect requested")

class LavalinkClient:
    def __init__(self, bot, config):
        global debug_log
        debug_log("LavalinkClient.__init__ started")
        self.bot = bot
        self.client = None
        self.config = config
        # Set debug function from main config
        if config.get('debug', False):
            from main import debug_log as main_debug
            debug_log = main_debug
        debug_log("LavalinkClient.__init__ completed")
        
    async def initialize(self):
        """Initialize Lavalink client"""
        debug_log("LavalinkClient.initialize started")
        debug_log(f"Bot user ID: {self.bot.user.id if self.bot.user else 'None'}")
        
        self.client = lavalink.Client(self.bot.user.id)
        debug_log("Created Lavalink client")
        
        # Load node settings from config
        lavalink_config = self.config['lavalink']
        debug_log(f"Lavalink config: {lavalink_config}")
        
        self.client.add_node(
            host=lavalink_config['host'],
            port=lavalink_config['port'],
            password=lavalink_config['password'],
            region=lavalink_config['region'],
            name=lavalink_config['name']
        )
        debug_log(f"Added node: {lavalink_config['name']}")
        
        # Add event hooks
        self.client.add_event_hook(self.track_hook)
        debug_log("Added event hook")
        
        logger.info("Lavalink client initialized")
        debug_log("LavalinkClient.initialize completed")
        
    async def track_hook(self, event):
        """Handle track events"""
        if isinstance(event, lavalink.events.QueueEndEvent):
            # Handle auto-leave after queue ends
            debug_log(f"Queue ended for guild {event.player.guild_id}")
            # Create task to handle auto-leave without blocking
            import asyncio
            asyncio.create_task(self.handle_auto_leave(event.player.guild_id))
                
        elif isinstance(event, lavalink.events.TrackStartEvent):
            if event.track and hasattr(event.track, 'title'):
                logger.info(f"Track started: {event.track.title}")
            
        elif isinstance(event, lavalink.events.TrackEndEvent):
            if event.track and hasattr(event.track, 'title'):
                logger.info(f"Track ended: {event.track.title}")
            
            # Also check for auto-leave when track ends and queue is empty
            player = event.player
            if player and (not hasattr(player, 'queue') or len(player.queue) == 0):
                debug_log(f"Track ended and queue is empty for guild {player.guild_id}")
                import asyncio
                asyncio.create_task(self.handle_auto_leave(player.guild_id))
            
    async def search_tracks(self, query):
        """Search for tracks"""
        debug_log(f"search_tracks called with query: {query}")
        
        # Don't add ytsearch if already present
        if not query.startswith('http') and not query.startswith('ytsearch:'):
            query = f"ytsearch:{query}"
            debug_log(f"Modified query to: {query}")
            
        if self.client and hasattr(self.client, 'get_tracks'):
            debug_log("Client available, searching tracks")
            results = await self.client.get_tracks(query)  # type: ignore
            debug_log(f"Search results: {len(results.tracks) if results and hasattr(results, 'tracks') else 'None'} tracks")
            return results
        debug_log("Client not available or missing get_tracks method")
        return None
    
    async def handle_auto_leave(self, guild_id):
        """Handle auto-leave functionality after queue ends"""
        import asyncio
        
        debug_log(f"Starting auto-leave handler for guild {guild_id}")
        
        # Get timeout setting for this guild
        timeout = 300  # Default 5 minutes
        if hasattr(self.bot, 'guild_settings') and guild_id in self.bot.guild_settings:
            timeout = self.bot.guild_settings[guild_id].get('auto_leave_timeout', 300)
        
        debug_log(f"Auto-leave timeout: {timeout} seconds for guild {guild_id}")
        
        if timeout <= 0:
            debug_log("Auto-leave disabled (timeout = 0)")
            return
            
        # Wait for the specified timeout
        debug_log(f"Waiting {timeout} seconds before checking auto-leave conditions...")
        await asyncio.sleep(timeout)
        debug_log(f"Auto-leave timeout expired for guild {guild_id}, checking conditions...")
        
        # Check if still no music playing
        player = self.get_player(guild_id)
        debug_log(f"Player exists: {player is not None}")
        
        if player:
            has_current = hasattr(player, 'current') and player.current is not None
            has_queue = hasattr(player, 'queue') and len(player.queue) > 0
            is_playing = getattr(player, 'is_playing', False)
            debug_log(f"Player state - has_current: {has_current}, has_queue: {has_queue}, is_playing: {is_playing}")
            
            # Only leave if no current track, no queue, and not playing
            if not has_current and not has_queue and not is_playing:
                debug_log(f"Conditions met for auto-leave in guild {guild_id}")
                
                # Get guild and disconnect
                guild = self.bot.get_guild(guild_id)
                debug_log(f"Guild found: {guild is not None}")
                
                if guild:
                    voice_client = guild.voice_client
                    debug_log(f"Voice client exists: {voice_client is not None}")
                    
                    if voice_client:
                        debug_log(f"Disconnecting from voice channel in guild {guild_id}")
                        try:
                            await voice_client.disconnect()
                            debug_log(f"Successfully disconnected from voice channel in guild {guild_id}")
                        except Exception as e:
                            debug_log(f"Error during disconnect: {str(e)}")
                    else:
                        debug_log("No voice client to disconnect")
                else:
                    debug_log("Guild not found")
            else:
                debug_log(f"Auto-leave conditions not met - music is still playing or queued")
        else:
            debug_log("No player found - cannot check auto-leave conditions")
        
    async def play_track(self, guild_id, track):
        """Play a track"""
        if self.client and hasattr(self.client, 'player_manager'):
            player = self.client.player_manager.get(guild_id)  # type: ignore
            if player:
                player.add(requester=0, track=track)
                if not player.is_playing:
                    await player.play()
                
    def get_player(self, guild_id):
        """Get player for guild"""
        debug_log(f"get_player called for guild {guild_id}")
        
        if self.client and hasattr(self.client, 'player_manager'):
            # In Lavalink.py, get() creates a player if it doesn't exist
            player = self.client.player_manager.create(guild_id)  # type: ignore
            debug_log(f"Player created/retrieved: {player is not None}")
            return player
        debug_log("Client not available or missing player_manager")
        return None
    
    async def destroy(self):
        """Safely destroy the Lavalink client"""
        debug_log("Starting Lavalink client destruction")
        
        try:
            if self.client:
                debug_log("Lavalink client exists, stopping all players")
                
                # Stop all players and clear queues
                if hasattr(self.client, 'player_manager'):
                    debug_log("Stopping all active players")
                    for guild_id, player in list(self.client.player_manager.players.items()):
                        try:
                            debug_log(f"Stopping player for guild {guild_id}")
                            if hasattr(player, 'stop'):
                                await player.stop()
                            if hasattr(player, 'queue') and hasattr(player.queue, 'clear'):
                                player.queue.clear()
                            debug_log(f"Player for guild {guild_id} stopped and cleared")
                        except Exception as e:
                            debug_log(f"Error stopping player for guild {guild_id}: {str(e)}")
                
                # Disconnect from Lavalink server
                debug_log("Destroying Lavalink client connection")
                if hasattr(self.client, 'destroy'):
                    await self.client.destroy()
                    debug_log("Lavalink client destroyed successfully")
                else:
                    debug_log("Lavalink client does not have destroy method")
                
                self.client = None
                debug_log("Lavalink client reference cleared")
            else:
                debug_log("No Lavalink client to destroy")
                
        except Exception as e:
            debug_log(f"Error during Lavalink client destruction: {str(e)}")
            logger.error(f"Error destroying Lavalink client: {str(e)}")
        
        debug_log("Lavalink client destruction completed")