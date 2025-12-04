import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Discord
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
  },

  // Database
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
  },

  // Spotify (for music)
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  },

  // YouTube
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
  },

  // Music Settings
  music: {
    maxQueueSize: parseInt(process.env.MUSIC_MAX_QUEUE_SIZE || '100'),
    maxDuration: parseInt(process.env.MUSIC_MAX_DURATION || '3600'),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Music platforms
export const MUSIC_PLATFORMS = {
  YOUTUBE: 'youtube',
  SPOTIFY: 'spotify',
  SOUNDCLOUD: 'soundcloud',
} as const;

export type MusicPlatform = typeof MUSIC_PLATFORMS[keyof typeof MUSIC_PLATFORMS];
