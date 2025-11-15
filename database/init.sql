-- Discord Bot Database Schema
-- Created: 2025-11-15

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Translation Feature Tables
-- ============================================

-- Translation channel pairs configuration
CREATE TABLE IF NOT EXISTS translation_channels (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  source_channel_id VARCHAR(20) NOT NULL,
  target_channel_id VARCHAR(20) NOT NULL,
  source_lang VARCHAR(10) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  bidirectional BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  use_failsafe BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, source_channel_id, target_channel_id)
);

-- Translation cache (optional, Redis is primary cache)
CREATE TABLE IF NOT EXISTS translation_cache (
  id SERIAL PRIMARY KEY,
  text_hash VARCHAR(64) NOT NULL,
  source_lang VARCHAR(10) NOT NULL,
  target_lang VARCHAR(10) NOT NULL,
  translated_text TEXT NOT NULL,
  provider VARCHAR(20) DEFAULT 'gemini',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(text_hash, source_lang, target_lang)
);

-- ============================================
-- TTS Feature Tables
-- ============================================

-- TTS enabled channels
CREATE TABLE IF NOT EXISTS tts_channels (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  auto_join BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, channel_id)
);

-- User voice models
CREATE TABLE IF NOT EXISTS user_voices (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  voice_name VARCHAR(100) NOT NULL,
  audio_file_path TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'ko',
  is_default BOOLEAN DEFAULT false,
  sample_rate INTEGER DEFAULT 22050,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, voice_name)
);

-- TTS history (for analytics)
CREATE TABLE IF NOT EXISTS tts_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  guild_id VARCHAR(20) NOT NULL,
  voice_id INTEGER REFERENCES user_voices(id) ON DELETE SET NULL,
  text_length INTEGER NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Music Feature Tables
-- ============================================

-- Music enabled channels
CREATE TABLE IF NOT EXISTS music_channels (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL,
  channel_id VARCHAR(20) NOT NULL,
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
  guild_id VARCHAR(20) NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  track_title TEXT,
  track_url TEXT,
  platform VARCHAR(20),
  duration_seconds INTEGER,
  played_at TIMESTAMP DEFAULT NOW()
);

-- Music playlists (user-created)
CREATE TABLE IF NOT EXISTS user_playlists (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
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
  guild_id VARCHAR(20) NOT NULL,
  command_name VARCHAR(100) NOT NULL,
  required_role_ids TEXT[],
  admin_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, command_name)
);

-- Guild configuration
CREATE TABLE IF NOT EXISTS guild_config (
  id SERIAL PRIMARY KEY,
  guild_id VARCHAR(20) NOT NULL UNIQUE,
  prefix VARCHAR(10) DEFAULT '!',
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX idx_translation_channels_guild ON translation_channels(guild_id);
CREATE INDEX idx_translation_channels_source ON translation_channels(source_channel_id);
CREATE INDEX idx_translation_channels_target ON translation_channels(target_channel_id);

CREATE INDEX idx_tts_channels_guild ON tts_channels(guild_id);
CREATE INDEX idx_tts_channels_channel ON tts_channels(channel_id);

CREATE INDEX idx_user_voices_user ON user_voices(user_id);
CREATE INDEX idx_user_voices_default ON user_voices(user_id, is_default) WHERE is_default = true;

CREATE INDEX idx_music_channels_guild ON music_channels(guild_id);
CREATE INDEX idx_music_channels_channel ON music_channels(channel_id);

CREATE INDEX idx_music_history_guild ON music_history(guild_id);
CREATE INDEX idx_music_history_user ON music_history(user_id);
CREATE INDEX idx_music_history_played_at ON music_history(played_at DESC);

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
CREATE TRIGGER update_translation_channels_updated_at BEFORE UPDATE ON translation_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_config_updated_at BEFORE UPDATE ON guild_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Initial Data (Optional)
-- ============================================

-- Insert default guild configs will be done by bot on guild join

COMMENT ON TABLE translation_channels IS 'Configuration for translation channel pairs';
COMMENT ON TABLE tts_channels IS 'Channels where TTS feature is enabled';
COMMENT ON TABLE user_voices IS 'User-registered voice models for TTS';
COMMENT ON TABLE music_channels IS 'Channels where music bot is enabled';
COMMENT ON TABLE command_permissions IS 'Custom permission settings for commands';
