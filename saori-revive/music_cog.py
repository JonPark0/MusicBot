import discord
from discord import app_commands
from music_player import MusicPlayer
import logging

logger = logging.getLogger('music_bot.music_cog')

def debug_log(message):
    """Debug logging function - will be set by main.py"""
    pass

class Music:
    def __init__(self, bot):
        global debug_log
        debug_log("Music cog __init__ started")
        self.bot = bot
        self.players = {}
        
        # Set debug function from bot config
        if hasattr(bot, 'config') or (hasattr(bot, 'lavalink_client') and hasattr(bot.lavalink_client, 'config')):
            config = getattr(bot, 'config', None) or getattr(bot.lavalink_client, 'config', {})
            if config.get('debug', False):
                from main import debug_log as main_debug
                debug_log = main_debug
        debug_log("Music cog __init__ completed")
        self.commands = [
            app_commands.Command(name='join', description='음성 채널로 입장합니다(카이팅용)', callback=self.join),
            app_commands.Command(name='play', description='음악을 재생합니다', callback=self.play),
            app_commands.Command(name='stop', description='재생을 중지하고 재생목록을 초기화합니다', callback=self.stop),
            app_commands.Command(name='skip', description='현재 재생중인 노래를 스킵합니다', callback=self.skip),
            app_commands.Command(name='queue', description='현재 재생목록을 출력합니다', callback=self.queue_info),
            app_commands.Command(name='seek', description='특정 시간으로 이동합니다', callback=self.seek),
            app_commands.Command(name='np', description='현재 재생중인 음악 정보를 표시합니다.', callback=self.now_playing),
            app_commands.Command(name='volume', description='볼륨의 크기를 조절합니다', callback=self.volume),
            app_commands.Command(name='pause', description='재생을 일시정지합니다', callback=self.pause),
            app_commands.Command(name='resume', description='재생을 재개합니다', callback=self.resume),
            app_commands.Command(name='set_timeout', description='재생 종료 후 음성채널에 머무는 시간을 설정합니다', callback=self.set_timeout),
            app_commands.Command(name='bind', description='이 서버에서 음악 명령어를 사용할 채널을 지정합니다', callback=self.bind_channel),
            app_commands.Command(name='unbind', description='채널 바인딩을 해제합니다', callback=self.unbind_channel),
            app_commands.Command(name='test_autoleave', description='자동 퇴장 기능을 즉시 테스트합니다', callback=self.test_auto_leave),
            app_commands.Command(name='test', description='Lavalink 서버 직접 테스트', callback=self.test_lavalink),
        ]

    def get_player(self, guild):
        player = self.players.get(guild.id)
        if player is None:
            player = MusicPlayer(self.bot, guild)
            self.players[guild.id] = player
        return player

    async def ensure_voice(self, interaction):
        """Ensure bot is connected to voice channel"""
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        
        if not player or not player.is_connected:
            if not interaction.user.voice:
                await interaction.response.send_message("You are not connected to a voice channel.", ephemeral=True)
                return False
                
            channel = interaction.user.voice.channel
            await channel.connect()
            await player.connect(channel.id)
            logger.info(f"Connected to voice channel {channel.name} in guild {interaction.guild.id}")
            
        return True

    async def join(self, interaction: discord.Interaction):
        debug_log(f"Join command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return False
        
        if not interaction.user.voice:
            debug_log("User not in voice channel")
            await interaction.response.send_message("You are not connected to a voice channel", ephemeral=True)
            return False
        
        channel = interaction.user.voice.channel
        debug_log(f"Target voice channel: {channel.name} (ID: {channel.id})")
        
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        try:
            # Connect through Discord voice with Lavalink VoiceClient
            if player:
                debug_log("Player available, proceeding with connection")
                
                # Disconnect first if already connected
                if interaction.guild.voice_client:
                    debug_log("Already connected to voice, disconnecting first")
                    await interaction.guild.voice_client.disconnect(force=True)
                    debug_log("Disconnected from previous voice channel")
                    
                debug_log("Importing LavalinkVoiceClient")
                from lavalink_client import LavalinkVoiceClient
                
                debug_log(f"Connecting to channel {channel.name}")
                await channel.connect(cls=LavalinkVoiceClient)
                debug_log("Voice connection established")
                
                await interaction.response.send_message(f"Joined {channel.name}")
                debug_log("Response sent to user")
                
                logger.info(f"Joined voice channel {channel.name} in guild {interaction.guild.id}")
                debug_log("Join command completed successfully")
                return True
            else:
                debug_log("Player not available")
                await interaction.response.send_message("Player not available", ephemeral=True)
                return False
        except Exception as e:
            debug_log(f"Exception occurred during join: {str(e)}")
            logger.error(f"Error joining channel in guild {interaction.guild.id}: {str(e)}")
            await interaction.response.send_message(f"An error occurred while joining the channel: {str(e)}", ephemeral=True)
            return False

    async def play(self, interaction: discord.Interaction, query: str):
        debug_log(f"Play command called with query: {query}")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        if not interaction.user.voice:
            debug_log("User not in voice channel")
            await interaction.response.send_message("You are not connected to a voice channel. Please join a voice channel first.", ephemeral=True)
            return

        debug_log("Deferring interaction response")
        await interaction.response.defer(thinking=True)
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        
        # Player should be created by get_player now
        debug_log(f"Player obtained: {player is not None}")
        
        # Ensure bot is in voice channel
        debug_log(f"Player connection status: {getattr(player, 'is_connected', False) if player else 'No player'}")
        if not player or not getattr(player, 'is_connected', False):
            debug_log("Connecting to voice channel")
            channel = interaction.user.voice.channel
            
            # Connect through Discord voice with Lavalink VoiceClient
            if player:
                debug_log(f"Connecting to voice channel: {channel.name}")
                try:
                    # Disconnect first if already connected
                    if interaction.guild.voice_client:
                        debug_log("Disconnecting existing voice client")
                        await interaction.guild.voice_client.disconnect(force=True)
                        
                    from lavalink_client import LavalinkVoiceClient
                    debug_log("Creating new LavalinkVoiceClient connection")
                    await channel.connect(cls=LavalinkVoiceClient)
                    debug_log("Voice connection established with Lavalink")
                    
                    # Wait a moment for connection to establish
                    import asyncio
                    await asyncio.sleep(3)
                    debug_log(f"Player connection status after voice connect: {getattr(player, 'is_connected', False)}")
                except Exception as e:
                    debug_log(f"Error connecting to voice channel: {str(e)}")
            else:
                debug_log("ERROR: Player not available!")

        # Get player wrapper
        debug_log("Getting music player wrapper")
        music_player = self.get_player(interaction.guild)
        music_player.last_interaction_channel = interaction.channel
        debug_log("Set last interaction channel")

        try:
            # Search for tracks
            debug_log(f"Processing search query: {query}")
            if not query.startswith('http'):
                query = f"ytsearch:{query}"
                debug_log(f"Modified to YouTube search: {query}")
                
            debug_log("Calling search_tracks")
            results = await self.bot.lavalink_client.search_tracks(query)
            debug_log(f"Search completed. Results: {results is not None}")
            
            if not results or not getattr(results, 'tracks', None):
                debug_log("No tracks found in results")
                await interaction.followup.send('No tracks found!', ephemeral=True)
                return
                
            track = results.tracks[0]
            debug_log(f"Selected track: {getattr(track, 'title', 'Unknown')}")
            
            if player and hasattr(player, 'add'):
                debug_log("Adding track to player queue")
                player.add(requester=interaction.user.id, track=track)  # type: ignore
                
                queue_size = len(getattr(player, 'queue', []))
                debug_log(f"Queue size after adding: {queue_size}")
                
                await interaction.followup.send(f'Joined {interaction.user.voice.channel.name} and queued: {track.title}\nCurrent queue size: {queue_size}')
                debug_log("Sent response to user")
                
                # Check if player is properly connected before playing
                debug_log(f"Pre-play check - Player connected: {getattr(player, 'is_connected', False)}")
                debug_log(f"Pre-play check - Discord voice client: {interaction.guild.voice_client is not None}")
                
                # Start playing if not already playing
                is_playing = getattr(player, 'is_playing', False)
                debug_log(f"Player is_playing status: {is_playing}")
                
                if not is_playing and hasattr(player, 'play'):
                    debug_log("Starting playback")
                    await player.play()  # type: ignore
                    debug_log("Playback command sent")
                    
                    # Give a moment for playback to start
                    import asyncio
                    await asyncio.sleep(1)
                    debug_log(f"Post-play check - Player is_playing: {getattr(player, 'is_playing', False)}")
                else:
                    debug_log(f"Not starting playback - is_playing: {is_playing}, has_play: {hasattr(player, 'play')}")
                
            logger.info(f"Added song '{track.title}' to queue for guild {interaction.guild.id}")
            debug_log("Play command completed successfully")
            
        except Exception as e:
            debug_log(f"Exception in play command: {str(e)}")
            logger.error(f"Error playing song in guild {interaction.guild.id}: {str(e)}")
            await interaction.followup.send(f'An error occurred while processing this request: {str(e)}', ephemeral=True)

    async def stop(self, interaction: discord.Interaction):
        debug_log("Stop command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        # Respond to interaction first
        debug_log("Sending stop response")
        await interaction.response.send_message("Playback stopped and queue cleared.")
        debug_log("Stop response sent")
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        debug_log("Getting music player wrapper")
        music_player = self.get_player(interaction.guild)
        debug_log(f"Music player wrapper obtained: {music_player is not None}")
        
        if player:
            debug_log("Processing Lavalink player stop")
            if hasattr(player, 'stop'):
                debug_log("Calling player.stop()")
                await player.stop()  # type: ignore
                debug_log("Player stopped successfully")
            else:
                debug_log("Player does not have stop method")
                
            if hasattr(player, 'queue') and hasattr(player.queue, 'clear'):
                debug_log("Clearing Lavalink queue")
                player.queue.clear()  # type: ignore
                debug_log("Lavalink queue cleared")
            else:
                debug_log("Player queue not available or no clear method")
        else:
            debug_log("No Lavalink player to stop")
            
        debug_log("Destroying music player wrapper")
        await music_player.destroy()
        debug_log("Music player destroyed")
        
        logger.info(f"Stopped playback and cleared queue for guild {interaction.guild.id}")
        debug_log("Stop command completed successfully")

    async def skip(self, interaction: discord.Interaction):
        debug_log("Skip command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        # Respond immediately to avoid timeout
        debug_log("Sending skip response")
        await interaction.response.send_message("Skipping current song...")
        debug_log("Skip response sent")
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        # Check if there's anything to skip (either playing or in queue)
        has_current = player and getattr(player, 'current', None) is not None
        has_queue = player and getattr(player, 'queue', None) and len(player.queue) > 0
        debug_log(f"Has current track: {has_current}")
        debug_log(f"Has queue: {has_queue}")
        
        if not player or (not has_current and not has_queue):
            debug_log("Nothing to skip - no player or no tracks")
            await interaction.followup.send("Actually, there's nothing to skip.", ephemeral=True)
            return
        
        debug_log("Player available and has tracks to skip")
        if hasattr(player, 'skip'):
            debug_log("Calling player.skip()")
            await player.skip()  # type: ignore
            debug_log("Skip command sent to player successfully")
        else:
            debug_log("Player does not have skip method")
            await interaction.followup.send("Player does not support skipping.", ephemeral=True)
            return
            
        logger.info(f"Skipped song in guild {interaction.guild.id}")
        debug_log("Skip command completed successfully")

    async def queue_info(self, interaction: discord.Interaction):
        debug_log("Queue info command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        player_queue = getattr(player, 'queue', None) if player else None
        debug_log(f"Player queue exists: {player_queue is not None}")
        debug_log(f"Queue length: {len(player_queue) if player_queue else 0}")
        
        if not player or not player_queue:
            debug_log("No queue to display")
            await interaction.response.send_message('There are currently no more queued songs.', ephemeral=True)
            return

        # Respond immediately to avoid timeout
        debug_log("Deferring response for queue processing")
        await interaction.response.defer(thinking=True)
        debug_log("Response deferred")
        
        # Create embed after responding
        debug_log("Getting music player wrapper")
        music_player = self.get_player(interaction.guild)
        debug_log(f"Music player wrapper obtained: {music_player is not None}")
        
        debug_log("Getting queue info from music player")
        queue_info = music_player.get_queue_info()
        debug_log(f"Queue info length: {len(queue_info) if queue_info else 0} characters")
        
        debug_log("Creating embed")
        embed = discord.Embed(title="Current Queue", description=queue_info, color=discord.Color.blue())
        
        debug_log("Sending queue embed via followup")
        await interaction.followup.send(embed=embed)
        debug_log("Queue info sent successfully")
        
        logger.info(f"Displayed queue info for guild {interaction.guild.id}")
        debug_log("Queue info command completed successfully")

    @staticmethod
    def parse_time(time_str):
        time_parts = time_str.split(':')
        if len(time_parts) == 3:  # HH:MM:SS
            hours, minutes, seconds = map(int, time_parts)
            return hours * 3600 + minutes * 60 + seconds
        elif len(time_parts) == 2:  # MM:SS
            minutes, seconds = map(int, time_parts)
            return minutes * 60 + seconds
        else:
            raise ValueError("Invalid time format. Use HH:MM:SS or MM:SS")

    async def seek(self, interaction: discord.Interaction, time: str):
        debug_log(f"Seek command called with time: {time}")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name}")
        
        try:
            debug_log("Parsing time format")
            seconds = self.parse_time(time)
            debug_log(f"Parsed time: {seconds} seconds")
            
            # Check if interaction is already responded to
            debug_log(f"Interaction responded status: {interaction.response.is_done()}")
            
            # Respond immediately to avoid timeout
            debug_log("Sending initial response")
            await interaction.response.send_message(f"Seeking to {MusicPlayer.format_time(seconds * 1000)}...")
            debug_log("Initial response sent successfully")
            
            # Then perform the seek operation
            debug_log("Getting music player")
            music_player = self.get_player(interaction.guild)
            debug_log(f"Music player obtained: {music_player is not None}")
            
            debug_log("Calling seek_internal")
            await music_player.seek_internal(seconds)
            debug_log("seek_internal completed successfully")
            
            logger.info(f"Seeked to {seconds} seconds in guild {interaction.guild.id}")
            debug_log("Seek command completed successfully")
            
        except ValueError as e:
            debug_log(f"ValueError occurred: {str(e)}")
            debug_log(f"Interaction responded status before error handling: {interaction.response.is_done()}")
            
            # Check if we already responded
            if interaction.response.is_done():
                debug_log("Using followup for error message (already responded)")
                await interaction.followup.send(str(e), ephemeral=True)
            else:
                debug_log("Using response for error message (not yet responded)")
                await interaction.response.send_message(str(e), ephemeral=True)
                
        except Exception as e:
            debug_log(f"General exception occurred: {str(e)}")
            debug_log(f"Interaction responded status before error handling: {interaction.response.is_done()}")
            
            # Always use followup for general exceptions since we likely already responded
            try:
                debug_log("Using followup for general error message")
                await interaction.followup.send(f"An error occurred while seeking: {str(e)}", ephemeral=True)
                debug_log("Followup error message sent successfully")
            except Exception as followup_error:
                debug_log(f"Failed to send followup error message: {str(followup_error)}")
                logger.error(f"Failed to handle seek error: {str(e)} and followup failed: {str(followup_error)}")

    async def now_playing(self, interaction: discord.Interaction):
        debug_log("Now playing command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        debug_log("Getting music player wrapper")
        music_player = self.get_player(interaction.guild)
        debug_log(f"Music player wrapper obtained: {music_player is not None}")
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        current_track = getattr(player, 'current', None) if player else None
        debug_log(f"Current track exists: {current_track is not None}")
        
        if not player or not current_track:
            debug_log("No song currently playing")
            await interaction.response.send_message("No song is currently playing.", ephemeral=True)
            return
        
        # Respond immediately to avoid timeout
        debug_log("Deferring response for embed creation")
        await interaction.response.defer(thinking=True)
        debug_log("Response deferred")
        
        # Create embed after responding (this might take time)
        debug_log("Creating now playing embed")
        embed = await music_player.create_now_playing_embed()
        debug_log(f"Embed created: {embed is not None}")
        
        if embed:
            debug_log("Sending now playing embed via followup")
            await interaction.followup.send(embed=embed)
            debug_log("Now playing info sent successfully")
            logger.info(f"Sent now playing info for guild {interaction.guild.id}")
        else:
            debug_log("Failed to create embed")
            await interaction.followup.send("Unable to create now playing information.", ephemeral=True)
        
        debug_log("Now playing command completed")

    async def volume(self, interaction: discord.Interaction, volume: int):
        debug_log("Volume command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        debug_log(f"Requested volume: {volume}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        # Validate volume range
        if not 0 <= volume <= 100:
            debug_log(f"Invalid volume range: {volume}")
            await interaction.response.send_message("Volume must be between 0 and 100.", ephemeral=True)
            return
        
        debug_log("Volume range validated")
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        if player and hasattr(player, 'set_volume'):
            debug_log(f"Setting volume to {volume}%")
            await player.set_volume(volume)  # type: ignore
            debug_log("Volume set successfully")
        else:
            debug_log("Player not available or does not support volume control")
        
        debug_log("Sending volume response")
        await interaction.response.send_message(f"Volume set to {volume}%")
        debug_log("Volume response sent")
        
        logger.info(f"Set volume to {volume}% in guild {interaction.guild.id}")
        debug_log("Volume command completed successfully")
        
    async def pause(self, interaction: discord.Interaction):
        debug_log("Pause command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        is_playing = getattr(player, 'is_playing', False) if player else False
        debug_log(f"Player is playing: {is_playing}")
        
        if not player or not is_playing:
            debug_log("Not currently playing anything")
            await interaction.response.send_message("Not currently playing anything.", ephemeral=True)
            return
            
        # Respond immediately to avoid timeout
        debug_log("Sending pause response")
        await interaction.response.send_message("Paused playback.")
        debug_log("Pause response sent")
        
        if hasattr(player, 'set_pause'):
            debug_log("Setting pause to True")
            await player.set_pause(True)  # type: ignore
            debug_log("Pause set successfully")
        else:
            debug_log("Player does not support pause")
            
        logger.info(f"Paused playback in guild {interaction.guild.id}")
        debug_log("Pause command completed successfully")
        
    async def resume(self, interaction: discord.Interaction):
        debug_log("Resume command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check channel binding
        if not self.check_channel_binding(interaction):
            debug_log("Command blocked by channel binding")
            bound_channel_id = self.bot.guild_settings[interaction.guild.id]['music_channel']
            bound_channel = interaction.guild.get_channel(bound_channel_id)
            await interaction.response.send_message(f"음악 명령어는 {bound_channel.mention} 채널에서만 사용할 수 있습니다.", ephemeral=True)
            return
        
        debug_log("Getting Lavalink player")
        player = self.bot.lavalink_client.get_player(interaction.guild.id)
        debug_log(f"Lavalink player obtained: {player is not None}")
        
        is_paused = getattr(player, 'paused', False) if player else False
        debug_log(f"Player is paused: {is_paused}")
        
        if not player or not is_paused:
            debug_log("Not currently paused")
            await interaction.response.send_message("Not currently paused.", ephemeral=True)
            return
            
        # Respond immediately to avoid timeout
        debug_log("Sending resume response")
        await interaction.response.send_message("Resumed playback.")
        debug_log("Resume response sent")
        
        if hasattr(player, 'set_pause'):
            debug_log("Setting pause to False")
            await player.set_pause(False)  # type: ignore
            debug_log("Resume set successfully")
        else:
            debug_log("Player does not support resume")
            
        logger.info(f"Resumed playback in guild {interaction.guild.id}")
        debug_log("Resume command completed successfully")

    async def test_lavalink(self, interaction: discord.Interaction):
        """Test Lavalink server directly with curl"""
        debug_log("Lavalink test command called")
        await interaction.response.defer(thinking=True)
        
        # Get config from bot
        config = getattr(self.bot, 'config', {})
        lavalink_config = config.get('lavalink', {})
        
        host = lavalink_config.get('host', '100.73.147.52')
        port = lavalink_config.get('port', 2333)
        password = lavalink_config.get('password', 'youshallnotpass')
        
        test_url = "https://youtu.be/1fWc6dNKBUo?si=LurH-WGxmibTVZ6f" # River – MusicbyAden (No Copyright Music)
        
        debug_log(f"Testing Lavalink server: {host}:{port}, Password: {password}")
        debug_log(f"Using test URL: {test_url}")
        
        # Test 1: Check if Lavalink server is responding
        debug_log("Step 1: Testing Lavalink server connectivity")
        
        import subprocess
        import json
        
        try:
            # Test server info endpoint
            result = subprocess.run([
                'curl', '-s', '-w', '%{http_code}',
                f'http://{host}:{port}/version',
                '-H', f'Authorization: {password}'
            ], capture_output=True, text=True, timeout=10)
            
            http_code = result.stdout[-3:]  # Last 3 characters are HTTP code
            response_body = result.stdout[:-3]  # Everything except HTTP code
            
            debug_log(f"Server connectivity test - HTTP Code: {http_code}")
            debug_log(f"Server response: {response_body}")
            
            if http_code == "200":
                await interaction.followup.send(f"✅ **Lavalink 서버 연결 성공**\n서버 정보: {response_body}")
            else:
                await interaction.followup.send(f"❌ **Lavalink 서버 연결 실패**\nHTTP Code: {http_code}\nResponse: {response_body}")
                return
                
        except subprocess.TimeoutExpired:
            debug_log("Server connectivity test timed out")
            await interaction.followup.send("❌ **Lavalink 서버 응답 없음** (타임아웃)")
            return
        except Exception as e:
            debug_log(f"Server connectivity test error: {str(e)}")
            await interaction.followup.send(f"❌ **연결 테스트 오류**: {str(e)}")
            return
        
        # Test 2: Search tracks
        debug_log("Step 2: Testing track search")
        
        try:
            # Try different API endpoints for Lavalink v4
            search_query = f"{test_url}"
            endpoints_to_try = [
                f'/v4/loadtracks?identifier={search_query}'
                # f'/loadtracks?identifier={search_query}',
                # f'/v3/loadtracks?identifier={search_query}'
            ]
            
            search_success = False
            for endpoint in endpoints_to_try:
                debug_log(f"Trying endpoint: {endpoint}")
                result = subprocess.run([
                    'curl', '-s', '-w', '%{http_code}',
                    f'http://{host}:{port}{endpoint}',
                    '-H', f'Authorization: {password}'
                ], capture_output=True, text=True, timeout=15)
                
                http_code = result.stdout[-3:]
                response_body = result.stdout[:-3]
                
                debug_log(f"Endpoint {endpoint} - HTTP Code: {http_code}")
                
                if http_code == "200":
                    search_success = True
                    break
            
            if search_success:
                debug_log(f"Track search test - HTTP Code: {http_code}")
                debug_log(f"Search response length: {len(response_body)}")
                debug_log(f"Successful endpoint: {endpoint}")
                try:
                    search_data = json.loads(response_body)
                    load_type = search_data.get('loadType', 'unknown')
                    debug_log(f"Raw search data: {search_data}")
                    
                    # Lavalink v4 구조 처리
                    tracks = []
                    if load_type == 'track':
                        # 단일 트랙
                        tracks = [search_data.get('data')]
                    elif load_type == 'search':
                        # 검색 결과
                        tracks = search_data.get('data', [])
                    elif load_type == 'playlist':
                        # 플레이리스트
                        playlist_data = search_data.get('data', {})
                        tracks = playlist_data.get('tracks', [])
                    else:
                        # v3 호환성 또는 다른 구조
                        tracks = search_data.get('tracks', [])
                    
                    track_count = len(tracks) if tracks else 0
                    debug_log(f"Search successful - Load type: {load_type}, Tracks: {track_count}")
                    
                    if track_count > 0:
                        track = tracks[0]
                        track_title = track.get('info', {}).get('title', 'Unknown')
                        track_duration = track.get('info', {}).get('length', 0)
                        
                        await interaction.followup.send(
                            f"✅ **트랙 검색 성공**\n"
                            f"제목: {track_title}\n"
                            f"길이: {track_duration//1000}초\n"
                            f"로드 타입: {load_type}\n"
                            f"총 트랙 수: {track_count}"
                        )
                    else:
                        debug_log(f"No tracks found - Data: {search_data}")
                        await interaction.followup.send(f"⚠️ **검색 결과 없음** Load type: {load_type}")
                        
                except json.JSONDecodeError as e:
                    debug_log(f"JSON decode error: {str(e)}")
                    await interaction.followup.send(f"❌ **응답 파싱 오류**: {str(e)}")
            else:
                debug_log("All endpoints failed")
                await interaction.followup.send(f"❌ **모든 엔드포인트 실패**\\n시도한 엔드포인트: {', '.join(endpoints_to_try)}")
                
        except subprocess.TimeoutExpired:
            debug_log("Track search timed out")
            await interaction.followup.send("❌ **트랙 검색 타임아웃**")
        except Exception as e:
            debug_log(f"Track search error: {str(e)}")
            await interaction.followup.send(f"❌ **검색 오류**: {str(e)}")
            
        # Test 3: WebSocket connection status
        debug_log("Step 3: Checking WebSocket connection")
        
        if self.bot.lavalink_client and self.bot.lavalink_client.client:
            nodes = getattr(self.bot.lavalink_client.client, 'node_manager', None)
            if nodes and hasattr(nodes, 'available_nodes'):
                available_nodes = [node for node in nodes.available_nodes if node.available]
                debug_log(f"Available nodes: {len(available_nodes)}")
                
                if available_nodes:
                    node = available_nodes[0]
                    stats = getattr(node, 'stats', None)
                    if stats:
                        await interaction.followup.send(
                            f"✅ **WebSocket 연결 활성**\n"
                            f"노드: {node.name}\n"
                            f"플레이어 수: {stats.players}\n"
                            f"재생 중: {stats.playing_players}\n"
                            f"업타임: {stats.uptime//1000}초"
                        )
                    else:
                        await interaction.followup.send("✅ **WebSocket 연결됨** (통계 정보 없음)")
                else:
                    await interaction.followup.send("❌ **사용 가능한 노드 없음**")
            else:
                await interaction.followup.send("❌ **노드 매니저 없음**")
        else:
            await interaction.followup.send("❌ **Lavalink 클라이언트 없음**")
            
        debug_log("Lavalink test completed")
    
    async def set_timeout(self, interaction: discord.Interaction, seconds: int):
        """Set auto-leave timeout after playback ends"""
        debug_log("Set timeout command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        debug_log(f"Requested timeout: {seconds} seconds")
        
        # Validate timeout range
        if seconds < 0 or seconds > 3600:  # Max 1 hour
            debug_log(f"Invalid timeout range: {seconds}")
            await interaction.response.send_message("타임아웃은 0-3600초 사이여야 합니다.", ephemeral=True)
            return
            
        debug_log("Timeout range validated")
        
        # Store timeout setting per guild
        debug_log("Initializing guild settings if needed")
        if not hasattr(self.bot, 'guild_settings'):
            self.bot.guild_settings = {}
            debug_log("Created guild_settings dictionary")
        
        guild_id = interaction.guild.id
        debug_log(f"Guild ID: {guild_id}")
        
        if guild_id not in self.bot.guild_settings:
            self.bot.guild_settings[guild_id] = {}
            debug_log("Created guild-specific settings")
            
        debug_log(f"Setting auto_leave_timeout to {seconds}")
        self.bot.guild_settings[guild_id]['auto_leave_timeout'] = seconds
        debug_log("Timeout setting saved")
        
        debug_log("Sending timeout response")
        await interaction.response.send_message(f"자동 퇴장 타임아웃이 {seconds}초로 설정되었습니다.")
        debug_log("Timeout response sent")
        
        logger.info(f"Auto-leave timeout set to {seconds}s for guild {guild_id}")
        debug_log("Set timeout command completed successfully")
    
    async def bind_channel(self, interaction: discord.Interaction, channel: discord.TextChannel):
        """Bind music commands to a specific channel (admin only)"""
        debug_log("Bind channel command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        debug_log(f"Target channel: {channel.name} (ID: {channel.id})")
        
        # Check if user has administrator permission
        has_admin = interaction.user.guild_permissions.administrator
        debug_log(f"User has admin permissions: {has_admin}")
        
        if not has_admin:
            debug_log("User lacks admin permissions")
            await interaction.response.send_message("이 명령어는 관리자만 사용할 수 있습니다.", ephemeral=True)
            return
            
        debug_log("Admin permission validated")
        
        # Store channel binding per guild
        debug_log("Initializing guild settings if needed")
        if not hasattr(self.bot, 'guild_settings'):
            self.bot.guild_settings = {}
            debug_log("Created guild_settings dictionary")
        
        guild_id = interaction.guild.id
        debug_log(f"Guild ID: {guild_id}")
        
        if guild_id not in self.bot.guild_settings:
            self.bot.guild_settings[guild_id] = {}
            debug_log("Created guild-specific settings")
            
        debug_log(f"Binding music commands to channel {channel.id}")
        self.bot.guild_settings[guild_id]['music_channel'] = channel.id
        debug_log("Channel binding saved")
        
        debug_log("Sending bind response")
        await interaction.response.send_message(f"음악 명령어가 {channel.mention} 채널에 바인딩되었습니다.")
        debug_log("Bind response sent")
        
        logger.info(f"Music commands bound to channel {channel.id} in guild {guild_id}")
        debug_log("Bind channel command completed successfully")
    
    async def unbind_channel(self, interaction: discord.Interaction):
        """Remove channel binding (admin only)"""
        debug_log("Unbind channel command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check if user has administrator permission
        has_admin = interaction.user.guild_permissions.administrator
        debug_log(f"User has admin permissions: {has_admin}")
        
        if not has_admin:
            debug_log("User lacks admin permissions")
            await interaction.response.send_message("이 명령어는 관리자만 사용할 수 있습니다.", ephemeral=True)
            return
            
        debug_log("Admin permission validated")
        
        # Remove channel binding
        debug_log("Checking for guild settings")
        if hasattr(self.bot, 'guild_settings'):
            guild_id = interaction.guild.id
            debug_log(f"Guild ID: {guild_id}")
            
            if guild_id in self.bot.guild_settings:
                debug_log("Guild settings found, removing music_channel binding")
                removed_channel = self.bot.guild_settings[guild_id].pop('music_channel', None)
                debug_log(f"Removed binding for channel: {removed_channel}")
            else:
                debug_log("No guild settings found for this guild")
        else:
            debug_log("No guild_settings attribute found")
                
        debug_log("Sending unbind response")
        await interaction.response.send_message("음악 명령어 채널 바인딩이 해제되었습니다.")
        debug_log("Unbind response sent")
        
        logger.info(f"Music commands unbound in guild {interaction.guild.id}")
        debug_log("Unbind channel command completed successfully")
    
    async def test_auto_leave(self, interaction: discord.Interaction):
        """Test auto-leave functionality immediately"""
        debug_log("Test auto-leave command called")
        debug_log(f"User: {interaction.user.name}, Guild: {interaction.guild.name if interaction.guild else 'None'}")
        
        # Check if user has administrator permission
        has_admin = interaction.user.guild_permissions.administrator
        debug_log(f"User has admin permissions: {has_admin}")
        
        if not has_admin:
            debug_log("User lacks admin permissions")
            await interaction.response.send_message("이 명령어는 관리자만 사용할 수 있습니다.", ephemeral=True)
            return
        
        debug_log("Admin permission validated")
        await interaction.response.send_message("자동 퇴장 기능을 테스트합니다. 10초 후 조건을 확인하여 음성 채널에서 나갑니다.")
        
        # Force trigger auto-leave with 10 second timeout for testing
        debug_log("Creating auto-leave test task")
        import asyncio
        
        async def test_auto_leave_task():
            debug_log("Auto-leave test task started")
            await asyncio.sleep(10)  # Wait 10 seconds for testing
            debug_log("Test timeout completed, checking auto-leave conditions")
            
            guild_id = interaction.guild.id
            player = self.bot.lavalink_client.get_player(guild_id)
            
            if player:
                has_current = hasattr(player, 'current') and player.current is not None
                has_queue = hasattr(player, 'queue') and len(player.queue) > 0
                is_playing = getattr(player, 'is_playing', False)
                debug_log(f"Test - Player state: has_current={has_current}, has_queue={has_queue}, is_playing={is_playing}")
                
                if not has_current and not has_queue and not is_playing:
                    debug_log("Test conditions met - disconnecting")
                    guild = self.bot.get_guild(guild_id)
                    if guild and guild.voice_client:
                        await guild.voice_client.disconnect()
                        debug_log("Test auto-leave: disconnected successfully")
                    else:
                        debug_log("Test auto-leave: no voice client to disconnect")
                else:
                    debug_log("Test conditions not met - not disconnecting")
            else:
                debug_log("Test: no player found")
        
        asyncio.create_task(test_auto_leave_task())
        debug_log("Test auto-leave command completed")
    
    def check_channel_binding(self, interaction: discord.Interaction) -> bool:
        """Check if command is allowed in current channel"""
        if not hasattr(self.bot, 'guild_settings'):
            return True
            
        guild_id = interaction.guild.id
        if guild_id not in self.bot.guild_settings:
            return True
            
        bound_channel = self.bot.guild_settings[guild_id].get('music_channel')
        if bound_channel and bound_channel != interaction.channel.id:
            return False
            
        return True