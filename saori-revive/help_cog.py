import discord
from discord import app_commands
import logging

logger = logging.getLogger('music_bot.help_cog')

class Help:
    def __init__(self, bot):
        self.bot = bot
        self.commands = [
            app_commands.Command(name='help', description='Shows the help message for music bot commands', callback=self.help_command)
        ]

    async def help_command(self, interaction: discord.Interaction):
        try:
            embed = discord.Embed(title="Music Bot Help", 
                                  description="가능한 명령어들:", 
                                  color=discord.Color.blue())

            commands_info = [
                ("join", "사오리가 접속중인 채팅방으로 따라옵니다"),
                ("play <곡명 또는 주소>", "음악을 재생하거나 재생목록에 추가합니다"),
                ("np", "현재 재생중인 음악에 대한 정보를 표시합니다"),
                ("stop", "음악 재생을 중지하고 재생목록을 초기화합니다"),
                ("skip", "현재 재생중인 곡을 스킵합니다"),
                ("queue", "현재 재생목록을 표시합니다"),
                ("seek <시간>", "특정 시간으로 이동합니다 (MM:SS 또는 HH:MM:SS 형식)"),
                ("pause", "재생을 일시정지합니다"),
                ("resume", "재생을 재개합니다"),
                ("volume <0-100>", "볼륨을 조정합니다"),
                ("set_timeout <초>", "재생이 끝나고 사오리가 음성채널에 머무는 시간을 설정합니다"),
                ("bind <채널>", "이 서버에서 음악 명령어를 사용할 채널을 지정합니다 (관리자만)"),
                ("unbind", "채널 바인딩을 해제합니다 (관리자만)"),
                ("test_autoleave", "자동 퇴장 기능을 즉시 테스트합니다 (관리자만)"),
                ("test", "Lavalink 서버 연결 상태를 테스트합니다"),
                ("help", "이 메시지를 표시합니다")
            ]

            for name, description in commands_info:
                embed.add_field(name=f"/{name}", value=description, inline=False)

            embed.set_footer(text="Music Bot Saori v3.0 With Lavalink by Warwick Kane | Created with Claude 4 Sonnet")

            await interaction.response.send_message(embed=embed)
        except Exception as e:
            logger.error(f"Error displaying help: {str(e)}")
            await interaction.response.send_message(f"An error occurred while displaying help: {str(e)}", ephemeral=True)