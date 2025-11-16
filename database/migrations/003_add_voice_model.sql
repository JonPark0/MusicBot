-- Add model column to user_voices table
-- Allows users to select preferred TTS model (xtts-v2, chatterbox)

ALTER TABLE user_voices
ADD COLUMN IF NOT EXISTS model VARCHAR(20) DEFAULT 'xtts-v2';

-- Add comment for documentation
COMMENT ON COLUMN user_voices.model IS 'TTS model to use (xtts-v2, chatterbox)';
