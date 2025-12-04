# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A Discord music streaming bot built for self-hosted deployment on homeservers with Docker. The bot uses TypeScript (Node.js 22) with Lavalink v4 for high-quality audio streaming from multiple platforms.

**Main Technologies:**
- **Bot**: TypeScript 5.9, discord.js v14.24, Node.js 22
- **Music**: Lavalink v4 for audio streaming (YouTube, Spotify, SoundCloud, Bandcamp, Twitch)
- **Infrastructure**: PostgreSQL 17, Redis 7, Docker Compose

## Architecture

### Service Communication Pattern

```
Discord Bot (TypeScript)
├── Music: WebSocket → Lavalink (port 2333)
└── Data: PostgreSQL + Redis
```

All services communicate via internal Docker network. No ports exposed to host by default.

### Key Architectural Patterns

1. **Singleton Music Player** ([bot/src/services/music/player.ts](bot/src/services/music/player.ts))
   - Created via `initializeMusicPlayer(client)` in [bot/src/index.ts](bot/src/index.ts) after bot ready event
   - Must call `initialize()` after bot is ready to set up Lavalink connection
   - Uses Lavalink client library for all audio streaming
   - Per-guild players managed by Lavalink's LavalinkManager

2. **Command Architecture**
   - Commands separated into `admin/` and `user/` directories
   - Music admin commands in [bot/src/commands/admin/music-admin.ts](bot/src/commands/admin/music-admin.ts)
   - Music user commands in [bot/src/commands/user/music.ts](bot/src/commands/user/music.ts)
   - Interaction handler in [bot/src/handlers/interactionHandler.ts](bot/src/handlers/interactionHandler.ts)
   - Permission middleware in [bot/src/middleware/permissions.ts](bot/src/middleware/permissions.ts)

3. **Database Schema** ([database/init.sql](database/init.sql))
   - Music-related tables: music_channels, music_history, user_playlists, playlist_tracks
   - Guild-specific configurations with triggers for `updated_at` timestamps
   - Performance indexes on frequent lookup patterns (guild_id, channel_id, enabled)

## Development Commands

### Docker Compose Workflow

```bash
# Standard deployment
docker compose up -d

# View logs
docker compose logs -f discord-bot
docker compose logs -f lavalink

# Deploy slash commands (required after changes to command definitions)
docker compose exec discord-bot npm run deploy-commands

# Restart services after code changes
docker compose restart discord-bot

# Rebuild after dependency changes
docker compose up -d --build discord-bot

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

### Database Operations

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d discord_bot

# Run manual query
docker compose exec postgres psql -U postgres -d discord_bot \
  -c "SELECT * FROM music_channels;"

# Backup database
docker compose exec postgres pg_dump -U postgres discord_bot > backup.sql

# Restore database
cat backup.sql | docker compose exec -T postgres psql -U postgres -d discord_bot
```

### Redis Operations

```bash
# Connect to Redis CLI
docker compose exec redis redis-cli -a your_redis_password

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
   - `POSTGRES_PASSWORD` - Database password
   - `REDIS_PASSWORD` - Redis password

2. **Optional Platform APIs**:
   - `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` - For better Spotify handling
   - `YOUTUBE_API_KEY` - For higher rate limits
   - `YOUTUBE_COOKIE` - For bypassing bot detection

3. **Service URLs** (Docker internal by default):
   - `DATABASE_URL` - PostgreSQL connection string
   - `REDIS_URL` - Redis connection string
   - `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`

### Discord Developer Portal Requirements

**CRITICAL**: Enable these Privileged Gateway Intents in Discord Developer Portal:
- ✅ **MESSAGE CONTENT INTENT** (required for message handling)
- ✅ **SERVER MEMBERS INTENT** (required for member info)

Without these, the bot will not function correctly.

## Important Technical Details

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
  - Music channel check: `SELECT * FROM music_channels WHERE guild_id = $1 AND channel_id = $2 AND enabled = true`
  - User playlists: `SELECT * FROM user_playlists WHERE user_id = $1`
  - Music history: `SELECT * FROM music_history WHERE guild_id = $1 ORDER BY played_at DESC`
- **History Tracking**: music_history table for analytics
- **Indexes**: All lookup queries use indexed columns (guild_id, channel_id, user_id, enabled)

### Caching Strategy

1. **Redis Cache**:
   - User session data
   - Rate limiting counters
   - Guild configurations (optional)

2. **In-Memory Cache**:
   - Guild configurations
   - Active player states
   - Voice connection states

## Testing and Debugging

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

## Important Warnings

- **Discord Intents**: Bot will fail silently if MESSAGE CONTENT INTENT is not enabled
- **Lavalink Dependency**: Music features require Lavalink v4 server running before bot starts
- **Rate Limits**: Monitor YouTube/Spotify API quotas if using API keys
- **File Permissions**: Docker volumes need proper permissions for `/app/audio` and `/app/logs`
