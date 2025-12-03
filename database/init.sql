-- Discord Bot Database Schema
-- Created: 2025-11-15
-- Modified: 2025-12-03 - Removed translation and TTS features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Music Feature Tables
-- ============================================

-- Music enabled channels
CREATE TABLE IF NOT EXISTS music_channels (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(25) NOT NULL,
  channel_id VARCHAR(25) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  max_queue_size INTEGER DEFAULT 100,
  max_duration_seconds INTEGER DEFAULT 3600,
  volume_limit INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, channel_id)
);

-- Music playback history
CREATE TABLE IF NOT EXISTS music_history (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(25) NOT NULL,
  user_id VARCHAR(25) NOT NULL,
  track_title TEXT,
  track_url TEXT,
  platform VARCHAR(20),
  duration_seconds INTEGER,
  played_at TIMESTAMP DEFAULT NOW()
);

-- Music playlists (user-created)
CREATE TABLE IF NOT EXISTS user_playlists (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(25) NOT NULL,
  playlist_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, playlist_name)
);

-- Playlist tracks
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER REFERENCES user_playlists(id) ON DELETE CASCADE,
  track_url TEXT NOT NULL,
  track_title TEXT,
  platform VARCHAR(20),
  position INTEGER NOT NULL,
  added_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Permission & Configuration Tables
-- ============================================

-- Custom command permissions
CREATE TABLE IF NOT EXISTS command_permissions (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(25) NOT NULL,
  command_name VARCHAR(100) NOT NULL,
  required_role_ids TEXT[],
  admin_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, command_name)
);

-- Guild configuration
CREATE TABLE IF NOT EXISTS guild_config (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(25) NOT NULL UNIQUE,
  prefix VARCHAR(10) DEFAULT '!',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Music indexes
CREATE INDEX idx_music_channels_guild ON music_channels(guild_id);
CREATE INDEX idx_music_channels_channel ON music_channels(channel_id);
CREATE INDEX idx_music_channels_lookup ON music_channels(guild_id, channel_id, enabled);
CREATE INDEX idx_music_history_guild ON music_history(guild_id);
CREATE INDEX idx_music_history_user ON music_history(user_id);
CREATE INDEX idx_music_history_played_at ON music_history(played_at DESC);
CREATE INDEX idx_music_history_platform ON music_history(platform);

-- Permission indexes
CREATE INDEX idx_command_permissions_guild ON command_permissions(guild_id);
CREATE INDEX idx_command_permissions_lookup ON command_permissions(guild_id, command_name);

-- ============================================
-- Functions & Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_guild_config_updated_at BEFORE UPDATE ON guild_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Initial Data (Optional)
-- ============================================

-- Insert default guild configs will be done by bot on guild join

COMMENT ON TABLE music_channels IS 'Channels where music bot is enabled';
COMMENT ON TABLE command_permissions IS 'Custom permission settings for commands';
