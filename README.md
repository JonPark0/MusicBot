# Discord Music Streaming Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

[한국어](./README.ko.md) | English

A powerful, self-hosted Discord music bot with Lavalink support, designed for personal homeserver deployment.

## Features

### Music Streaming

- Multi-platform support: YouTube, Spotify, SoundCloud, Bandcamp, Twitch
- Real-time streaming using Lavalink v4 (no downloads required)
- Playlist support for all platforms
- Advanced queue management (shuffle, loop modes, skip, remove)
- Volume control and playback controls
- Per-guild player management
- Music playback history tracking

## Architecture

```
Docker Compose Stack
├── Discord Bot (Node.js 22 / TypeScript 5.9)
├── Lavalink v4 Audio Server
├── PostgreSQL 17 Database
└── Redis 7 Cache
```

## Tech Stack

- **Discord Bot**: Node.js 22, TypeScript 5.9, discord.js v14.24
- **Music**: Lavalink v4, lavalink-client v2.5, @discordjs/voice 0.19
- **Database**: PostgreSQL 17
- **Cache**: Redis 7
- **Deployment**: Docker, Docker Compose

## Prerequisites

- Docker & Docker Compose
- Discord Bot Token ([Create here](https://discord.com/developers/applications))
- (Optional) Spotify Client ID & Secret for better Spotify handling
- (Optional) YouTube API Key for higher rate limits
- At least 4GB RAM (8GB recommended)
- 5GB free disk space

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/discord_bot.git
cd discord_bot

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env and add your tokens
nano .env

# 4. Configure Discord Developer Portal
# Go to https://discord.com/developers/applications
# Select your bot → Bot → Enable "MESSAGE CONTENT INTENT" and "SERVER MEMBERS INTENT"

# 5. Start the services
docker compose up -d

# 6. Deploy slash commands
docker compose exec discord-bot npm run deploy-commands
```

## Configuration

Edit `.env` file with your credentials:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password

# Optional - Music Platforms (work without API keys)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
YOUTUBE_API_KEY=your_youtube_api_key
YOUTUBE_COOKIE=your_youtube_cookie

# Lavalink Configuration
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
```

### Discord Developer Portal Setup

**Important**: Enable these Privileged Gateway Intents in your bot settings:
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application → **Bot** section
3. Enable:
   - ✅ **MESSAGE CONTENT INTENT**
   - ✅ **SERVER MEMBERS INTENT**
4. Save Changes

## Commands

### Music Commands (User)

- `/music play <query>` - Play a song or add to queue
- `/music pause` - Pause current playback
- `/music resume` - Resume playback
- `/music skip` - Skip current song
- `/music stop` - Stop playback and clear queue
- `/music queue` - View current queue
- `/music nowplaying` - Show currently playing track
- `/music volume <level>` - Set volume (0-100)
- `/music shuffle` - Shuffle the queue
- `/music loop <mode>` - Set loop mode (off, track, queue)
- `/music remove <position>` - Remove track from queue

### Music Commands (Admin)

- `/music-admin enable` - Enable music in current channel
- `/music-admin disable` - Disable music in current channel
- `/music-admin config` - View music configuration

## Security Features

- Internal network-only communication between services
- No exposed ports to host network
- Redis authentication required
- Environment-based credential management
- Automatic resource cleanup

## Performance

- Music: Near-instant playback with Lavalink streaming
- Resource Usage:
  - Bot: ~200MB RAM
  - Lavalink: ~500MB RAM
  - PostgreSQL: ~100MB RAM
  - Redis: ~50MB RAM

## Troubleshooting

### Music not playing

1. Check Lavalink is running: `docker compose logs lavalink`
2. Verify bot has voice permissions in your server
3. Ensure you're in a voice channel before playing music

### Bot not responding

1. Check bot logs: `docker compose logs discord-bot`
2. Verify Discord intents are enabled in Developer Portal
3. Ensure slash commands are deployed: `docker compose exec discord-bot npm run deploy-commands`

## Development

```bash
# View logs
docker compose logs -f discord-bot

# Restart bot
docker compose restart discord-bot

# Rebuild after code changes
docker compose up -d --build discord-bot

# Stop all services
docker compose down
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [discord.js](https://discord.js.org/) - Discord API library
- [Lavalink](https://github.com/lavalink-devs/Lavalink) - Audio streaming server
- [lavalink-client](https://github.com/Tomato6966/lavalink-client) - Lavalink client library

## Support

For issues and questions:
- Open an issue on GitHub
- Check documentation for troubleshooting
