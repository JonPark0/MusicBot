# Discord Multi-Function Bot

A powerful, self-hosted Discord bot with translation, TTS (Text-to-Speech), and music streaming capabilities.

## Features

### 🌐 Translation
- **Automatic cross-channel translation** using Google Gemini AI API
- **Failsafe support** with LibreTranslate for offline/backup translation
- **Context-aware translation** that preserves Discord formatting (mentions, emojis, etc.)
- **Bidirectional translation** support
- **Multiple language support**: English, Korean, Japanese, Chinese, Spanish, French, German, Russian, Portuguese, Italian

### 🎤 Text-to-Speech (TTS)
- **Custom voice cloning** using Coqui XTTS-v2 model
- **User-specific voice registration** (6-12 second audio samples)
- **Multiple voices per user** with easy switching
- **Automatic playback** in voice channels when users type in TTS-enabled text channels
- **Multi-language support** for TTS synthesis

### 🎵 Music Streaming
- **Multi-platform support**: YouTube, Spotify, SoundCloud
- **Real-time streaming** (no downloads required)
- **Playlist support** for all platforms
- **Advanced queue management** (shuffle, loop, remove)
- **Volume control** and playback controls (pause, resume, skip)
- **Track history** and analytics

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Compose Stack                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Discord Bot  │  │ TTS Service  │  │LibreTranslate│  │
│  │  (Node.js)   │  │  (Python)    │  │  (Failsafe)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                              │
│  ┌──────┴─────────────────┴──────────────┐             │
│  │         PostgreSQL Database            │             │
│  └────────────────────────────────────────┘             │
│  ┌────────────────────────────────────────┐             │
│  │         Redis Cache & Queue            │             │
│  └────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Discord Bot**: Node.js, TypeScript, discord.js v14
- **TTS Service**: Python, FastAPI, Coqui XTTS-v2, PyTorch
- **Translation**: Google Gemini 2.0 Flash, LibreTranslate
- **Music**: play-dl, FFmpeg, @discordjs/voice
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Containerization**: Docker, Docker Compose

## Prerequisites

- Docker & Docker Compose
- Discord Bot Token ([Create here](https://discord.com/developers/applications))
- Google Gemini API Key ([Get here](https://aistudio.google.com/app/apikey))
- (Optional) Spotify Client ID & Secret for Spotify support
- (Optional) NVIDIA GPU for faster TTS processing

## Quick Start

See [SETUP.md](./docs/SETUP.md) for detailed installation instructions.

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/discord_bot.git
cd discord_bot

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env and add your tokens
nano .env

# 4. Start the services
docker-compose up -d

# 5. Deploy slash commands
docker-compose exec discord-bot npm run deploy-commands
```

## Configuration

Edit `.env` file with your credentials:

```env
# Required
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
GEMINI_API_KEY=your_gemini_api_key
POSTGRES_PASSWORD=your_secure_password

# Optional
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

## Commands

See [COMMANDS.md](./docs/COMMANDS.md) for a complete list of commands.

### Quick Reference

**Translation:**
- `/translate-admin setup` - Configure translation pairs
- `/translate status` - Check translation status

**TTS:**
- `/tts register` - Register your voice
- `/tts-admin enable-channel` - Enable TTS in a channel

**Music:**
- `/music play <url>` - Play a track or playlist
- `/music queue` - Show current queue
- `/music-admin enable-channel` - Enable music in a channel

## Project Structure

```
discord_bot/
├── bot/                    # Node.js Discord Bot
│   ├── src/
│   │   ├── commands/       # Slash commands
│   │   ├── services/       # Business logic
│   │   ├── handlers/       # Event handlers
│   │   └── utils/          # Utilities
│   ├── Dockerfile
│   └── package.json
├── tts-service/           # Python TTS Service
│   ├── models/            # XTTS-v2 wrapper
│   ├── api/               # FastAPI endpoints
│   ├── Dockerfile
│   └── requirements.txt
├── database/
│   └── init.sql           # Database schema
├── docker-compose.yml
└── .env
```

## Performance

- **Translation**: ~1-2 seconds per message (Gemini) or ~0.5s (cached)
- **TTS**: ~2-5 seconds to generate speech (CPU), ~1-2s (GPU)
- **Music**: Near-instant playback with streaming
- **Resource Usage**:
  - Bot: ~200MB RAM
  - TTS Service: ~2-4GB RAM (model loaded)
  - LibreTranslate: ~1GB RAM
  - PostgreSQL: ~100MB RAM
  - Redis: ~50MB RAM

## Security

- All credentials stored in environment variables
- Database credentials not exposed
- Discord token kept secure
- No data logging of user messages (only metadata)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check [SETUP.md](./docs/SETUP.md) for troubleshooting

## Acknowledgments

- [discord.js](https://discord.js.org/) - Discord API library
- [Coqui TTS](https://github.com/coqui-ai/TTS) - XTTS-v2 model
- [Google Gemini](https://ai.google.dev/) - AI-powered translation
- [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) - Open-source translation
- [play-dl](https://github.com/play-dl/play-dl) - Music streaming library
