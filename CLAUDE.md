# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A multi-functional Discord bot with translation (Google Gemini AI), TTS (Text-to-Speech with voice cloning), and music streaming capabilities. Built for self-hosted deployment on homeservers with Docker. The bot uses a microservices architecture with TypeScript (Node.js 22) for the main bot and Python (FastAPI) for the TTS service.

**Main Technologies:**
- **Bot**: TypeScript 5.9, discord.js v14.24, Node.js 22
- **TTS Service**: Python 3.11, FastAPI, Coqui XTTS-v2, PyTorch (CUDA 12.4 / ROCm 6.0+ support)
- **Music**: Lavalink v4 for audio streaming (YouTube, Spotify, SoundCloud)
- **Translation**: Google Gemini 2.0 Flash API with LibreTranslate failover
- **Infrastructure**: PostgreSQL 17, Redis 7, Docker Compose

## Architecture

### Service Communication Pattern

```
Discord Bot (TypeScript)
├── Translation: Gemini API → LibreTranslate (failover) → Redis cache
├── TTS: HTTP → TTS Service (FastAPI on port 8000)
├── Music: WebSocket → Lavalink (port 2333)
└── Data: PostgreSQL + Redis
```

All services communicate via internal Docker network. No ports exposed to host by default.

### Key Architectural Patterns

1. **Translation Gateway Pattern** ([bot/src/services/translation/gateway.ts](bot/src/services/translation/gateway.ts))
   - Primary provider: Google Gemini with automatic failover to LibreTranslate
   - SHA-256 hashed cache keys for translation results
   - 24-hour Redis TTL for cached translations
   - Gemini handles language detection as primary, LibreTranslate as fallback

2. **Singleton Music Player** ([bot/src/services/music/player.ts](bot/src/services/music/player.ts))
   - Created via `initializeMusicPlayer(client)` in [bot/src/index.ts](bot/src/index.ts) after bot ready event
   - Must call `initialize()` after bot is ready to set up Lavalink connection
   - Uses Lavalink client library for all audio streaming (replaces discord-player)
   - Per-guild players managed by Lavalink's LavalinkManager

3. **Command Architecture**
   - Commands separated into `admin/` and `user/` directories
   - Each feature has paired admin and user commands (e.g., `translate-admin.ts` and `translate.ts`)
   - Interaction handler in [bot/src/handlers/interactionHandler.ts](bot/src/handlers/interactionHandler.ts)
   - Message handler for auto-translation in [bot/src/handlers/messageHandler.ts](bot/src/handlers/messageHandler.ts)
   - Permission middleware in [bot/src/middleware/permissions.ts](bot/src/middleware/permissions.ts)

4. **TTS Microservice** ([tts-service/main.py](tts-service/main.py))
   - Multi-model support via factory pattern ([tts-service/models/factory.py](tts-service/models/factory.py))
   - Automatic text chunking for long inputs ([tts-service/utils/text_chunker.py](tts-service/utils/text_chunker.py))
   - Voice samples stored at `/app/voices/{user_id}/{voice_name}.wav`
   - Generated audio cached at `/app/cache/{hash}.wav` with MD5 hashing
   - Cache cleanup task runs periodically based on `CACHE_CLEANUP_HOURS`

5. **Database Schema** ([database/init.sql](database/init.sql))
   - Feature-based table groups: translation, TTS, music, permissions
   - Guild-specific configurations with triggers for `updated_at` timestamps
   - Performance indexes on frequent lookup patterns (guild_id, channel_id, enabled)

## Development Commands

### Docker Compose Workflow

```bash
# Standard CPU deployment
docker compose up -d

# NVIDIA GPU/CUDA deployment (2-3x faster TTS)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# AMD GPU/ROCm deployment (2-3x faster TTS)
docker compose -f docker-compose.yml -f docker-compose.rocm.yml up -d

# Enable LibreTranslate failover (optional)
docker compose --profile libretranslate up -d

# View logs
docker compose logs -f discord-bot
docker compose logs -f tts-service

# Deploy slash commands (required after changes to command definitions)
docker compose exec discord-bot npm run deploy-commands

# Restart services after code changes
docker compose restart discord-bot
docker compose restart tts-service

# Rebuild after dependency changes
docker compose up -d --build discord-bot
docker compose up -d --build tts-service

# Stop all services
docker compose down
```

### Bot Development (TypeScript)

```bash
cd bot/

# Install dependencies
npm install

# Build TypeScript
npm run build

# Development mode with ts-node (hot reload)
npm run dev

# Watch mode (auto-rebuild on changes)
npm run watch

# Deploy slash commands to Discord
npm run deploy-commands        # Development
npm run deploy-commands:prod   # Production
```

### TTS Service Development (Python)

```bash
cd tts-service/

# Install dependencies
pip install -r requirements.txt        # CPU version
pip install -r requirements-gpu.txt    # GPU/CUDA version

# Run development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Test TTS endpoint
curl -X POST http://localhost:8000/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "user_id": "123", "language": "en"}'

# Check health
curl http://localhost:8000/health
curl http://localhost:8000/models
curl http://localhost:8000/languages
```

### Database Operations

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d discord_bot

# Run manual query
docker compose exec postgres psql -U postgres -d discord_bot \
  -c "SELECT * FROM translation_channels;"

# Backup database
docker compose exec postgres pg_dump -U postgres discord_bot > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U postgres -d discord_bot
```

### Redis Operations

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli -a your_redis_password

# Check translation cache
KEYS translation:*

# Clear all cache
FLUSHALL

# Monitor real-time commands
MONITOR
```

### Lavalink Operations

```bash
# Check Lavalink health
curl -H "Authorization: youshallnotpass" http://localhost:2333/version

# View Lavalink logs
docker compose logs -f lavalink

# Lavalink configuration
# Edit: lavalink/application.yml
```

## Configuration

### Environment Variables Priority

1. **Required Core Variables** (must be set in `.env`):
   - `DISCORD_TOKEN` - Discord bot token
   - `DISCORD_CLIENT_ID` - Discord application ID
   - `GEMINI_API_KEY` - Google Gemini API key
   - `POSTGRES_PASSWORD` - Database password
   - `REDIS_PASSWORD` - Redis password

2. **Optional Platform APIs**:
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` - For better Spotify handling
   - `YOUTUBE_API_KEY` - For higher rate limits
   - `YOUTUBE_COOKIE` - For bypassing bot detection
   - `LIBRETRANSLATE_URL` - Enable translation failover

3. **Service URLs** (Docker internal by default):
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `TTS_SERVICE_URL` - TTS service endpoint
   - `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`

### Discord Developer Portal Requirements

**CRITICAL**: Enable these Privileged Gateway Intents in Discord Developer Portal:
- ✅ **MESSAGE CONTENT INTENT** (required for auto-translation)
- ✅ **SERVER MEMBERS INTENT** (required for member info)

Without these, the bot will not function correctly.

## Important Technical Details

### Translation System

- **Primary Flow**: Message → Gemini API → Translation → Redis Cache (24hr TTL)
- **Failover Flow**: Gemini error → LibreTranslate (if enabled) → Redis Cache
- **Message Sync**: Edits and deletions are tracked via message relationship mapping
- **Cache Key**: SHA-256 hash of `{source_lang}:{target_lang}:{text}`
- **Rate Limiting**: Handled by Gemini API quotas, no bot-level throttling

### TTS Voice Cloning

- **Model**: Coqui XTTS-v2 (supports 16 languages)
- **Voice Registration**: 6-12 second audio sample required
- **Processing Pipeline**:
  1. Upload → Validate format (WAV/MP3/OGG/FLAC)
  2. Convert to WAV 22050Hz mono
  3. Normalize audio levels
  4. Validate duration (6-12s)
  5. Store at `/app/voices/{user_id}/{voice_name}.wav`
- **Synthesis**: Text → Chunks (if >250 chars) → Generate audio per chunk → Concatenate → Cache
- **Speed Control**: 0.5x to 2.0x speed multiplier
- **Multi-Model Support**: Can load multiple TTS models via `TTS_MODELS` environment variable

### Music Streaming (Lavalink)

- **Architecture**: Bot sends commands → Lavalink extracts/streams audio → Discord voice
- **Platform Support**: YouTube, Spotify (converts to YouTube), SoundCloud, Bandcamp, Twitch
- **Queue Management**: Per-guild queue with loop modes (off, track, queue)
- **Voice Protocol**: Custom LavalinkVoiceClient implements Discord's VoiceProtocol
- **Event Handling**: trackStart, trackEnd, queueEnd, trackError, playerDestroy
- **Player Lifecycle**:
  1. User joins voice channel
  2. Bot creates player via `manager.createPlayer()`
  3. Player connects to voice channel
  4. Tracks added to queue
  5. Playback starts automatically if not playing
  6. Player destroyed on stop or disconnect

### Database Access Patterns

- **Connection Pooling**: PostgreSQL client with connection pool ([bot/src/database/client.ts](bot/src/database/client.ts))
- **Common Queries**:
  - Translation pairs by guild: `SELECT * FROM translation_channels WHERE guild_id = $1 AND enabled = true`
  - TTS channel check: `SELECT * FROM tts_channels WHERE guild_id = $1 AND channel_id = $2 AND enabled = true`
  - User's default voice: `SELECT * FROM user_voices WHERE user_id = $1 AND is_default = true`
- **History Tracking**: music_history and tts_history tables for analytics
- **Indexes**: All lookup queries use indexed columns (guild_id, channel_id, user_id, enabled)

### Caching Strategy

1. **Redis Cache** (primary):
   - Translation results (24hr TTL)
   - User session data
   - Rate limiting counters

2. **TTS File Cache**:
   - Generated audio files in `/app/cache/`
   - LRU eviction when size exceeds `MAX_CACHE_SIZE_GB`
   - Cleanup runs every `CACHE_CLEANUP_HOURS`

3. **In-Memory Cache**:
   - Guild configurations
   - Active player states
   - Voice connection states

## Testing and Debugging

### Lavalink Connectivity

The codebase includes a legacy Saori bot at `saori-revive/` with Lavalink test scripts:

```bash
# Quick connectivity check
./saori-revive/quick-test-lavalink.sh

# Comprehensive test suite
./saori-revive/test-lavalink.sh

# Detailed debugging
./saori-revive/debug-lavalink.sh
```

These scripts test:
- Lavalink server reachability
- WebSocket connection
- Track loading and playback
- Node statistics

### Log Levels

Set `LOG_LEVEL` environment variable:
- `error` - Critical errors only
- `warn` - Warnings and errors
- `info` - General operational info (default)
- `debug` - Verbose debugging info

### Health Checks

```bash
# Bot health (process check)
docker compose exec discord-bot pgrep -f 'node dist/index.js'

# TTS service health
curl http://localhost:8000/health

# Lavalink health
curl -H "Authorization: youshallnotpass" http://localhost:2333/version

# PostgreSQL health
docker compose exec postgres pg_isready -U postgres -d discord_bot

# Redis health
docker compose exec redis redis-cli -a your_redis_password ping
```

## Common Development Tasks

### Adding a New Slash Command

1. Create command file in `bot/src/commands/admin/` or `bot/src/commands/user/`
2. Implement command class with `data` (SlashCommandBuilder) and `execute` method
3. Register in `bot/src/index.ts` via `interactionHandler.registerCommand()`
4. Run `npm run deploy-commands` to register with Discord
5. Test in Discord server

### Adding a New TTS Model

1. Create model class in `tts-service/models/` implementing `BaseTTSModel`
2. Register in `tts-service/models/factory.py` in `TTSModelFactory.AVAILABLE_MODELS`
3. Add model to `TTS_MODELS` environment variable
4. Restart TTS service
5. Model available via `/synthesize` endpoint with `model` parameter

### Modifying Database Schema

1. Edit `database/init.sql` with new schema changes
2. For existing deployments:
   ```bash
   # Connect to database
   docker compose exec postgres psql -U postgres -d discord_bot

   # Run migration SQL manually
   ALTER TABLE ...
   ```
3. For new deployments: Schema applies automatically on first startup

### Adding Translation Language Pairs

1. Verify language is supported by Gemini 2.0 Flash (most languages supported)
2. If using LibreTranslate, check language is in `LT_LOAD_ONLY` in docker-compose.yml
3. Add language code to command choices in `bot/src/commands/admin/translate-admin.ts`
4. No code changes needed - translation gateway handles dynamically

## GPU Acceleration Setup

### NVIDIA GPU (CUDA)

**Requirements:**
- NVIDIA GPU with CUDA Compute Capability 3.5+
- NVIDIA drivers version 525.60.13 or higher
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed

**Installation Steps:**

```bash
# 1. Install NVIDIA Container Toolkit (Ubuntu/Debian)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# 2. Configure Docker to use NVIDIA runtime
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# 3. Verify NVIDIA GPU is available
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi

# 4. Start bot with GPU support
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

**Performance:** 2-3x faster TTS synthesis compared to CPU (~1-2 seconds vs 2-5 seconds)

### AMD GPU (ROCm)

**Requirements:**
- AMD GPU compatible with ROCm 6.0+ ([compatibility list](https://rocm.docs.amd.com/en/latest/release/gpu_os_support.html))
- ROCm 6.0 or higher installed
- Compatible AMD GPUs: RX 6000/7000 series, Radeon Pro, Instinct MI series

**Installation Steps:**

```bash
# 1. Install ROCm (Ubuntu 22.04)
sudo apt-get update
wget https://repo.radeon.com/amdgpu-install/6.0/ubuntu/jammy/amdgpu-install_6.0.60000-1_all.deb
sudo apt-get install ./amdgpu-install_6.0.60000-1_all.deb
sudo amdgpu-install -y --usecase=rocm

# 2. Add user to render and video groups
sudo usermod -a -G render,video $USER
newgrp render

# 3. Verify ROCm installation
rocm-smi

# 4. Configure Docker for ROCm
# Add to /etc/docker/daemon.json:
{
  "runtimes": {
    "rocm": {
      "path": "/usr/bin/rocm-runtime",
      "runtimeArgs": []
    }
  }
}
sudo systemctl restart docker

# 5. Create docker-compose.rocm.yml (override file)
# See docker-compose.rocm.yml section below

# 6. Start bot with ROCm support
docker compose -f docker-compose.yml -f docker-compose.rocm.yml up -d
```

**docker-compose.rocm.yml example:**

```yaml
services:
  tts-service:
    devices:
      - /dev/kfd
      - /dev/dri
    group_add:
      - video
      - render
    environment:
      - ROCM_VISIBLE_DEVICES=0  # GPU ID to use
      - HSA_OVERRIDE_GFX_VERSION=10.3.0  # Set for your GPU (e.g., 10.3.0 for RX 6000)
```

**Note:** ROCm support requires PyTorch built with ROCm support. You may need to create a custom TTS service Dockerfile with ROCm-compatible PyTorch:

```dockerfile
# Example: tts-service/Dockerfile.rocm
FROM rocm/pytorch:rocm6.0_ubuntu22.04_py3.10_pytorch_2.1.1

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy application
COPY . /app
WORKDIR /app

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Performance:** Similar to NVIDIA (2-3x faster than CPU), though may vary by GPU model

### Verifying GPU Acceleration

```bash
# Check TTS service is using GPU
docker compose logs tts-service | grep -i "cuda\|rocm\|gpu"

# Monitor GPU usage during TTS generation
# NVIDIA:
watch -n 1 nvidia-smi

# AMD:
watch -n 1 rocm-smi

# Test TTS synthesis and check logs
curl -X POST http://localhost:8000/synthesize \
  -F "text=This is a test of GPU acceleration" \
  -F "user_id=123" \
  -F "language=en"
```

## Important Warnings

- **Discord Intents**: Bot will fail silently if MESSAGE CONTENT INTENT is not enabled
- **Lavalink Dependency**: Music features require Lavalink v4 server running before bot starts
- **NVIDIA GPU Support**: CUDA setup requires NVIDIA Container Toolkit and drivers ≥525.60.13
- **AMD GPU Support**: ROCm setup requires ROCm 6.0+ drivers and compatible AMD GPU (see ROCm compatibility matrix)
- **Voice Sample Quality**: Poor quality samples (background noise, too short) result in poor TTS output
- **Rate Limits**: Gemini API has daily quotas - monitor usage in Google AI Studio
- **File Permissions**: Docker volumes need proper permissions for `/app/voices` and `/app/cache`

## Legacy Saori Bot

The `saori-revive/` directory contains a legacy Python-based Discord music bot:
- Uses discord.py and direct Lavalink integration
- Separate project, not part of main TypeScript bot
- Useful for Lavalink testing scripts and reference implementation
- Not recommended for active development (TypeScript bot is current)
