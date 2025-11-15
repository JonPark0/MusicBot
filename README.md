# Discord Multi-Function Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-green.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

[한국어](./README.ko.md) | English

A powerful, self-hosted Discord bot with translation, TTS (Text-to-Speech), and music streaming capabilities, designed for personal homeserver deployment.

## Features

### Translation

- Automatic cross-channel translation using Google Gemini AI API
- Failsafe support with LibreTranslate for offline/backup translation
- Context-aware translation that preserves Discord formatting
- Bidirectional translation support
- Multi-language support: English, Korean, Japanese, Chinese, Spanish, French, German, Russian, Portuguese, Italian

### Text-to-Speech (TTS)

- Custom voice cloning using Coqui XTTS-v2 model
- User-specific voice registration (6-12 second audio samples)
- Multiple voices per user with easy switching
- Automatic playback in voice channels
- Multi-language support for TTS synthesis

### Music Streaming

- Multi-platform support: YouTube, Spotify, SoundCloud
- Real-time streaming (no downloads required)
- Playlist support for all platforms
- Advanced queue management (shuffle, loop, remove)
- Volume control and playback controls

## Architecture

```
Docker Compose Stack
├── Discord Bot (Node.js/TypeScript)
├── TTS Service (Python/FastAPI)
├── LibreTranslate (Failsafe)
├── PostgreSQL Database
└── Redis Cache & Queue
```

## Tech Stack

- **Discord Bot**: Node.js, TypeScript, discord.js v14
- **TTS Service**: Python, FastAPI, Coqui XTTS-v2, PyTorch
- **Translation**: Google Gemini 2.0 Flash, LibreTranslate
- **Music**: play-dl, FFmpeg, @discordjs/voice
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Deployment**: Docker, Docker Compose

## Prerequisites

- Docker & Docker Compose
- Discord Bot Token ([Create here](https://discord.com/developers/applications))
- Google Gemini API Key ([Get here](https://aistudio.google.com/app/apikey))
- (Optional) Spotify Client ID & Secret for Spotify support
- (Optional) NVIDIA GPU for faster TTS processing
- At least 8GB RAM (16GB recommended for TTS)
- 10GB free disk space

## Quick Start

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
REDIS_PASSWORD=your_redis_password

# Optional
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

## Documentation

- [Setup Guide](./docs/SETUP.md) - Detailed installation instructions
- [Commands Reference](./docs/COMMANDS.md) - Complete list of commands
- [한국어 설치 가이드](./docs/SETUP.ko.md) - 한국어 설치 방법
- [한국어 명령어](./docs/COMMANDS.ko.md) - 한국어 명령어 목록

## Security Features

- Internal network-only communication between services
- No exposed ports to host network
- Redis authentication required
- Environment-based credential management
- Automatic resource cleanup

## Performance

- Translation: ~1-2 seconds per message (Gemini) or ~0.5s (cached)
- TTS: ~2-5 seconds to generate speech (CPU), ~1-2s (GPU)
- Music: Near-instant playback with streaming
- Resource Usage:
  - Bot: ~200MB RAM
  - TTS Service: ~2-4GB RAM (model loaded)
  - LibreTranslate: ~1GB RAM
  - PostgreSQL: ~100MB RAM
  - Redis: ~50MB RAM

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [discord.js](https://discord.js.org/) - Discord API library
- [Coqui TTS](https://github.com/coqui-ai/TTS) - XTTS-v2 model
- [Google Gemini](https://ai.google.dev/) - AI-powered translation
- [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) - Open-source translation
- [play-dl](https://github.com/play-dl/play-dl) - Music streaming library

## Support

For issues and questions:
- Open an issue on GitHub
- Check [SETUP.md](./docs/SETUP.md) for troubleshooting
