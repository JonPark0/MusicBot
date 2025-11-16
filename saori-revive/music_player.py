import asyncio
import discord
import lavalink
import time
import logging

logger = logging.getLogger('music_bot.music_player')

class MusicPlayer:
    def __init__(self, bot, guild):
        self.bot = bot
        self.guild = guild
        self.lavalink_client = bot.lavalink_client
        self.last_interaction_channel = None
        self.np_message = None
        self.update_task = None
        
    @property
    def player(self):
        """Get Lavalink player for this guild"""
        return self.lavalink_client.get_player(self.guild.id)
        
    async def destroy(self):
        """Destroy the player"""
        logger.info(f"Destroying player for guild {self.guild.id}")
        if self.update_task:
            self.update_task.cancel()
            
        player = self.player
        if player:
            if hasattr(player, 'stop'):
                await player.stop()  # type: ignore
            if hasattr(player, 'queue') and hasattr(player.queue, 'clear'):
                player.queue.clear()  # type: ignore
            
        await self.cleanup()
        
    async def cleanup(self):
        """Cleanup player resources"""
        logger.info(f"Cleaning up player for guild {self.guild.id}")
        
        # No need to disconnect Discord voice client - Lavalink handles voice connection
        # Lavalink player will be cleaned up by destroy() method
            
        if self.np_message:
            try:
                await self.np_message.delete()
            except discord.HTTPException:
                pass
            self.np_message = None
            
    async def create_now_playing_embed(self):
        """Create now playing embed"""
        player = self.player
        if not player or not getattr(player, 'current', None):
            return None
            
        track = player.current
        embed = discord.Embed(
            title="Now Playing", 
            description=getattr(track, 'title', 'Unknown')[:256], 
            color=discord.Color.blue()
        )
        
        duration = self.format_time(getattr(track, 'duration', 0))
        embed.add_field(name="Duration", value=duration)
        
        if getattr(player, 'is_playing', False):
            current_time = getattr(player, 'position', 0)
            track_duration = getattr(track, 'duration', 1)
            if track_duration > 0:
                progress = min(int(20 * current_time / track_duration), 20)
                progress_bar = f"{'▓' * progress}{'░' * (20 - progress)}"
                progress_field = f"{self.format_time(current_time)}/{duration}\n{progress_bar}"
                embed.add_field(name="Progress", value=progress_field, inline=False)
            
        queue_info = self.get_queue_info()
        if queue_info:
            embed.add_field(name="Up Next", value=queue_info, inline=False)
            
        return embed
        
    def get_queue_info(self):
        """Get queue information"""
        player = self.player
        queue = getattr(player, 'queue', None) if player else None
        if not queue:
            return "No songs in queue."
            
        queue_list = "\n".join(
            f"{i+1}. {getattr(track, 'title', 'Unknown')[:30]}..." 
            for i, track in enumerate(list(queue)[:5])
        )
        
        if len(queue) > 5:
            queue_list += f"\n... and {len(queue) - 5} more."
            
        return queue_list
        
    @staticmethod
    def format_time(milliseconds):
        """Format time from milliseconds to readable format"""
        seconds = milliseconds // 1000
        minutes, seconds = divmod(seconds, 60)
        hours, minutes = divmod(minutes, 60)
        
        if hours:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        else:
            return f"{minutes:02d}:{seconds:02d}"
            
    async def now_playing(self, interaction: discord.Interaction):
        """Legacy now playing method - avoid using this"""
        player = self.player
        if player and getattr(player, 'current', None):
            embed = await self.create_now_playing_embed()
            await interaction.response.send_message(embed=embed)
            self.np_message = await interaction.original_response()
            self.last_interaction_channel = interaction.channel
            
            # Start update task
            if self.update_task:
                self.update_task.cancel()
            self.update_task = self.bot.loop.create_task(self.update_np_message())
            
            logger.info(f"Sent now playing info for guild {self.guild.id}")
        else:
            await interaction.response.send_message("No song is currently playing.", ephemeral=True)
            
    async def update_np_message(self):
        """Update now playing message periodically"""
        try:
            while True:
                player = self.player
                if not player or not getattr(player, 'current', None):
                    break
                    
                embed = await self.create_now_playing_embed()
                if self.np_message and embed:
                    try:
                        await self.np_message.edit(embed=embed)
                    except discord.errors.NotFound:
                        if self.last_interaction_channel:
                            self.np_message = await self.last_interaction_channel.send(embed=embed)
                            
                await asyncio.sleep(5)
                
        except asyncio.CancelledError:
            logger.info(f"Update task cancelled for guild {self.guild.id}")
        except Exception as e:
            logger.error(f"Error updating now playing message for guild {self.guild.id}: {str(e)}")
            
    async def seek_internal(self, seconds: int):
        """Internal seek method that doesn't handle interaction responses"""
        try:
            from main import debug_log
        except ImportError:
            debug_log = lambda x: None
            
        debug_log(f"seek_internal called with seconds: {seconds}")
        
        player = self.player
        debug_log(f"Player exists: {player is not None}")
        
        if not player:
            debug_log("No player available")
            raise ValueError("No song is currently playing.")
            
        current_track = getattr(player, 'current', None)
        debug_log(f"Current track exists: {current_track is not None}")
        
        if not current_track:
            debug_log("No current track")
            raise ValueError("No song is currently playing.")
            
        milliseconds = seconds * 1000
        debug_log(f"Converted to milliseconds: {milliseconds}")
        
        track_duration = getattr(current_track, 'duration', 0)
        debug_log(f"Track duration: {track_duration}ms")
        
        if milliseconds < 0:
            debug_log("Seek time is negative")
            raise ValueError(f"Seek time must be between 0 and {self.format_time(track_duration)}")
            
        if milliseconds > track_duration:
            debug_log(f"Seek time {milliseconds} exceeds track duration {track_duration}")
            raise ValueError(f"Seek time must be between 0 and {self.format_time(track_duration)}")
            
        debug_log(f"Seek time validation passed: {milliseconds} <= {track_duration}")
        
        if hasattr(player, 'seek'):
            debug_log("Player supports seeking, calling player.seek()")
            await player.seek(milliseconds)  # type: ignore
            debug_log("player.seek() completed successfully")
        else:
            debug_log("Player does not support seeking")
            raise ValueError("Player does not support seeking.")
        
        # Update now playing message
        debug_log("Updating now playing message")
        embed = await self.create_now_playing_embed()
        if self.np_message and embed:
            try:
                await self.np_message.edit(embed=embed)
                debug_log("Now playing message updated successfully")
            except Exception as e:
                debug_log(f"Error updating now playing message: {str(e)}")
                logger.debug(f"Could not update now playing message: {str(e)}")
                
        logger.info(f"Seeked to {milliseconds}ms in guild {self.guild.id}")
        debug_log("seek_internal completed successfully")
                
    async def seek(self, interaction: discord.Interaction, seconds: int):
        """Legacy seek method for backward compatibility - avoid using this"""
        try:
            await self.seek_internal(seconds)
            await interaction.response.send_message(f"Seeked to {self.format_time(seconds * 1000)}.")
        except ValueError as e:
            await interaction.response.send_message(str(e), ephemeral=True)
        except Exception as e:
            logger.error(f"Error seeking: {str(e)}")
            await interaction.response.send_message(f"An error occurred while seeking: {str(e)}", ephemeral=True)