-- Migration 001: Fix Discord ID column sizes
-- Discord Snowflake IDs can be up to 19 digits, but should allow for future growth
-- Changing from VARCHAR(20) to VARCHAR(25) for safety

-- Translation channels
ALTER TABLE translation_channels ALTER COLUMN guild_id TYPE VARCHAR(25);
ALTER TABLE translation_channels ALTER COLUMN source_channel_id TYPE VARCHAR(25);
ALTER TABLE translation_channels ALTER COLUMN target_channel_id TYPE VARCHAR(25);

-- TTS channels
ALTER TABLE tts_channels ALTER COLUMN guild_id TYPE VARCHAR(25);
ALTER TABLE tts_channels ALTER COLUMN channel_id TYPE VARCHAR(25);

-- User voices
ALTER TABLE user_voices ALTER COLUMN user_id TYPE VARCHAR(25);

-- TTS history
ALTER TABLE tts_history ALTER COLUMN user_id TYPE VARCHAR(25);
ALTER TABLE tts_history ALTER COLUMN guild_id TYPE VARCHAR(25);

-- Music channels
ALTER TABLE music_channels ALTER COLUMN guild_id TYPE VARCHAR(25);
ALTER TABLE music_channels ALTER COLUMN channel_id TYPE VARCHAR(25);

-- Music history
ALTER TABLE music_history ALTER COLUMN guild_id TYPE VARCHAR(25);
ALTER TABLE music_history ALTER COLUMN user_id TYPE VARCHAR(25);

-- User playlists
ALTER TABLE user_playlists ALTER COLUMN user_id TYPE VARCHAR(25);

-- Command permissions
ALTER TABLE command_permissions ALTER COLUMN guild_id TYPE VARCHAR(25);

-- Guild config
ALTER TABLE guild_config ALTER COLUMN guild_id TYPE VARCHAR(25);
