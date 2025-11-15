# Setup Guide

Complete guide to setting up the Discord Multi-Function Bot.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Discord Bot Setup](#discord-bot-setup)
3. [API Keys Setup](#api-keys-setup)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Starting the Bot](#starting-the-bot)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- **Docker** (v20.10 or higher) & **Docker Compose** (v2.0 or higher)
- **Discord Bot Token**
- **Google Gemini API Key** (free tier available)
- At least **8GB RAM** (16GB recommended for TTS)
- **10GB free disk space**

### Optional

- **NVIDIA GPU** with CUDA support (for faster TTS)
- **Spotify Client ID & Secret** (for Spotify music support)
- **YouTube API Key** (for better search results)

## Discord Bot Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Give it a name (e.g., "Multi-Function Bot")
4. Click "Create"

### 2. Create Bot User

1. Go to "Bot" tab
2. Click "Add Bot"
3. Under "Privileged Gateway Intents", enable:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
4. Click "Reset Token" and copy the token (save it securely)

### 3. Set Bot Permissions

Under "Bot" > "Bot Permissions", select:
- ✅ Read Messages/View Channels
- ✅ Send Messages
- ✅ Embed Links
- ✅ Attach Files
- ✅ Read Message History
- ✅ Connect (Voice)
- ✅ Speak (Voice)
- ✅ Use Voice Activity

### 4. Enable Slash Commands

1. Go to "OAuth2" > "General"
2. Note down your "Client ID"

### 5. Invite Bot to Server

Use this URL (replace CLIENT_ID with your actual client ID):

```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=36768832&scope=bot%20applications.commands
```

## API Keys Setup

### Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Choose "Create API key in new project" or select existing project
4. Copy the API key

**Note**: Gemini 2.0 Flash has a generous free tier (1500 requests/day).

### Spotify API (Optional)

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create an App"
3. Fill in app name and description
4. Accept terms and click "Create"
5. Note down "Client ID" and "Client Secret"

### YouTube API (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable "YouTube Data API v3"
4. Create credentials (API Key)
5. Copy the API key

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/discord_bot.git
cd discord_bot
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Edit Environment Variables

Open `.env` in your favorite editor:

```bash
nano .env
# or
vim .env
```

Fill in the required values:

```env
# Discord (REQUIRED)
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here

# Google Gemini (REQUIRED)
GEMINI_API_KEY=your_gemini_api_key_here

# Database (REQUIRED - use a strong password)
POSTGRES_PASSWORD=your_secure_password_here

# Spotify (OPTIONAL)
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here

# YouTube (OPTIONAL)
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## Starting the Bot

### 1. Build and Start Services

```bash
docker-compose up -d
```

This will:
- Download necessary Docker images
- Build bot and TTS service containers
- Start PostgreSQL and Redis
- Initialize the database
- Start all services

**Note**: First build may take 10-15 minutes.

### 2. Check Service Status

```bash
docker-compose ps
```

All services should show "Up" status.

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f discord-bot
docker-compose logs -f tts-service
```

### 4. Deploy Slash Commands

```bash
docker-compose exec discord-bot npm run deploy-commands
```

You should see: "Successfully reloaded X application (/) commands."

### 5. Verify Bot is Online

Check your Discord server - the bot should appear online.

## GPU Support (Optional)

To enable GPU acceleration for TTS:

### 1. Install NVIDIA Container Toolkit

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
```

### 2. Verify GPU Access

```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi
```

### 3. Uncomment GPU Settings

In `docker-compose.yml`, uncomment the GPU section under `tts-service`:

```yaml
tts-service:
  # ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

### 4. Restart Services

```bash
docker-compose down
docker-compose up -d
```

## Configuration

### Channel Setup

#### Translation

1. In your Discord server, run:
   ```
   /translate-admin setup
   ```
2. Select source and target channels
3. Choose languages
4. Enable bidirectional translation

#### TTS

1. Enable TTS in a text channel:
   ```
   /tts-admin enable-channel channel:#tts-chat
   ```
2. Register your voice:
   ```
   /tts register voice-name:"My Voice" audio-file:[upload 6-10s audio]
   ```

#### Music

1. Enable music in a text channel:
   ```
   /music-admin enable-channel channel:#music-requests
   ```
2. Play music:
   ```
   /music play url:https://youtube.com/watch?v=...
   ```

## Troubleshooting

### Bot Won't Start

**Check logs:**
```bash
docker-compose logs discord-bot
```

**Common issues:**
- Invalid Discord token → Check `.env`
- Database connection failed → Check PostgreSQL is running
- Port conflicts → Check if ports 5432, 6379, 5000, 8000 are free

### Translation Not Working

**Check:**
- Gemini API key is valid
- LibreTranslate is running: `docker-compose logs libretranslate`
- Translation pair is configured correctly
- Channels are set to enabled

**Test Gemini API:**
```bash
docker-compose exec discord-bot node -e "console.log(process.env.GEMINI_API_KEY)"
```

### TTS Service Errors

**Check logs:**
```bash
docker-compose logs tts-service
```

**Common issues:**
- Out of memory → Increase Docker memory limit (need 4GB+)
- Model download failed → Check internet connection, restart service
- Audio file format error → Use WAV/MP3 format, 6-12 seconds length

**Restart TTS service:**
```bash
docker-compose restart tts-service
```

### Music Playback Issues

**Check:**
- User is in a voice channel
- Music channel is enabled
- FFmpeg is installed (included in Docker image)
- play-dl can access the URL

**Test streaming:**
```bash
docker-compose exec discord-bot npm test
```

### Database Connection Issues

**Reset database:**
```bash
docker-compose down -v
docker-compose up -d
```

**Warning**: This will delete all data!

### General Debug Mode

Enable debug logging in `.env`:
```env
LOG_LEVEL=debug
```

Restart services:
```bash
docker-compose restart
```

## Updating the Bot

```bash
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose exec discord-bot npm run deploy-commands
```

## Backup and Restore

### Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U postgres discord_bot > backup.sql

# Backup voice files
tar -czf voices_backup.tar.gz data/voices/
```

### Restore

```bash
# Restore database
docker-compose exec -T postgres psql -U postgres discord_bot < backup.sql

# Restore voice files
tar -xzf voices_backup.tar.gz
```

## Performance Tuning

### For Low-Memory Systems (<8GB RAM)

In `docker-compose.yml`:

```yaml
tts-service:
  environment:
    - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
  mem_limit: 2g
```

### For High-Performance Systems

Increase worker threads in `.env`:
```env
TTS_QUEUE_SIZE=20
MUSIC_MAX_QUEUE_SIZE=200
```

## Security Best Practices

1. **Never commit `.env` to version control**
2. **Use strong PostgreSQL password**
3. **Regularly update Docker images**
4. **Enable firewall on server**
5. **Restrict Discord bot permissions to minimum required**
6. **Monitor logs for suspicious activity**

## Getting Help

- Check [Common Issues](#troubleshooting)
- Review logs: `docker-compose logs`
- Open an issue on GitHub
- Join our Discord support server (link in README)

## Next Steps

- Configure translation channels
- Register TTS voices
- Set up music channels
- Read [COMMANDS.md](./COMMANDS.md) for all available commands
