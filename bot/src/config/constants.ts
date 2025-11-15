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
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // External Services
  services: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    libreTranslateUrl: process.env.LIBRETRANSLATE_URL || 'http://localhost:5000',
    ttsServiceUrl: process.env.TTS_SERVICE_URL || 'http://localhost:8000',
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

  // TTS Settings
  tts: {
    maxLength: parseInt(process.env.TTS_MAX_LENGTH || '500'),
    queueSize: parseInt(process.env.TTS_QUEUE_SIZE || '10'),
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

// Supported languages for translation
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  ko: 'Korean',
  ja: 'Japanese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  pt: 'Portuguese',
  it: 'Italian',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Music platforms
export const MUSIC_PLATFORMS = {
  YOUTUBE: 'youtube',
  SPOTIFY: 'spotify',
  SOUNDCLOUD: 'soundcloud',
} as const;

export type MusicPlatform = typeof MUSIC_PLATFORMS[keyof typeof MUSIC_PLATFORMS];
