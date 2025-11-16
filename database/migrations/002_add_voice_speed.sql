-- Migration 002: Add speed column to user_voices table
-- Allows users to set a default speed for each voice

ALTER TABLE user_voices ADD COLUMN IF NOT EXISTS speed FLOAT DEFAULT 1.0;

-- Ensure speed is within valid range (0.5 to 2.0)
ALTER TABLE user_voices ADD CONSTRAINT speed_range CHECK (speed >= 0.5 AND speed <= 2.0);
