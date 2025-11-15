import play from 'play-dl';
import { createAudioResource, StreamType } from '@discordjs/voice';
import { logger } from '../../utils/logger';
import { config } from '../../config/constants';

export interface Track {
  title: string;
  url: string;
  duration: number;
  platform: string;
  requestedBy: string;
  thumbnail?: string;
}

export class MusicStreamingService {
  constructor() {
    this.initializePlayDl();
  }

  private async initializePlayDl() {
    // Set up Spotify credentials if available
    if (config.spotify.clientId && config.spotify.clientSecret) {
      try {
        await play.setToken({
          spotify: {
            client_id: config.spotify.clientId,
            client_secret: config.spotify.clientSecret,
            refresh_token: '',
            market: 'US',
          },
        });
        logger.info('Spotify credentials configured');
      } catch (error) {
        logger.warn('Failed to configure Spotify credentials', error);
      }
    }
  }

  /**
   * Get track information from URL
   */
  async getTrack(url: string, requestedBy: string): Promise<Track | null> {
    try {
      // Validate URL
      if (!play.validate(url)) {
        logger.warn('Invalid URL provided', { url });
        return null;
      }

      const type = play.validate(url);

      if (type === 'yt_video') {
        return await this.getYouTubeTrack(url, requestedBy);
      } else if (type === 'sp_track') {
        return await this.getSpotifyTrack(url, requestedBy);
      } else if (type === 'so_track') {
        return await this.getSoundCloudTrack(url, requestedBy);
      }

      return null;
    } catch (error) {
      logger.error('Error getting track info', { error, url });
      return null;
    }
  }

  /**
   * Get playlist tracks
   */
  async getPlaylist(url: string, requestedBy: string): Promise<Track[]> {
    try {
      const type = play.validate(url);

      if (type === 'yt_playlist') {
        return await this.getYouTubePlaylist(url, requestedBy);
      } else if (type === 'sp_playlist' || type === 'sp_album') {
        return await this.getSpotifyPlaylist(url, requestedBy);
      } else if (type === 'so_playlist') {
        return await this.getSoundCloudPlaylist(url, requestedBy);
      }

      return [];
    } catch (error) {
      logger.error('Error getting playlist', { error, url });
      return [];
    }
  }

  /**
   * Get YouTube track
   */
  private async getYouTubeTrack(url: string, requestedBy: string): Promise<Track> {
    const info = await play.video_info(url);
    const video = info.video_details;

    return {
      title: video.title || 'Unknown',
      url: video.url,
      duration: video.durationInSec,
      platform: 'youtube',
      requestedBy,
      thumbnail: video.thumbnails[0]?.url,
    };
  }

  /**
   * Get YouTube playlist
   */
  private async getYouTubePlaylist(url: string, requestedBy: string): Promise<Track[]> {
    const playlist = await play.playlist_info(url, { incomplete: true });
    const videos = await playlist.all_videos();

    return videos.map((video) => ({
      title: video.title || 'Unknown',
      url: video.url,
      duration: video.durationInSec,
      platform: 'youtube',
      requestedBy,
      thumbnail: video.thumbnails[0]?.url,
    }));
  }

  /**
   * Get Spotify track (converts to YouTube)
   */
  private async getSpotifyTrack(url: string, requestedBy: string): Promise<Track | null> {
    const spotifyData = await play.spotify(url);

    if (!spotifyData || spotifyData.type !== 'track') {
      return null;
    }

    // Search for equivalent on YouTube
    const searchQuery = `${spotifyData.name} ${spotifyData.artists[0]?.name || ''}`;
    const searchResults = await play.search(searchQuery, { limit: 1, source: { youtube: 'video' } });

    if (searchResults.length === 0) {
      logger.warn('No YouTube match found for Spotify track', { url });
      return null;
    }

    const video = searchResults[0];

    return {
      title: spotifyData.name,
      url: video.url,
      duration: spotifyData.durationInSec,
      platform: 'spotify',
      requestedBy,
      thumbnail: spotifyData.thumbnail?.url,
    };
  }

  /**
   * Get Spotify playlist/album (converts to YouTube)
   */
  private async getSpotifyPlaylist(url: string, requestedBy: string): Promise<Track[]> {
    const spotifyData = await play.spotify(url);

    if (!spotifyData) {
      return [];
    }

    const tracks: Track[] = [];
    const spotifyTracks = 'tracks' in spotifyData ? spotifyData.tracks : [];

    // Limit to 50 tracks to avoid rate limiting
    const limitedTracks = spotifyTracks.slice(0, 50);

    for (const track of limitedTracks) {
      try {
        const searchQuery = `${track.name} ${track.artists[0]?.name || ''}`;
        const searchResults = await play.search(searchQuery, { limit: 1, source: { youtube: 'video' } });

        if (searchResults.length > 0) {
          const video = searchResults[0];
          tracks.push({
            title: track.name,
            url: video.url,
            duration: track.durationInSec,
            platform: 'spotify',
            requestedBy,
            thumbnail: track.thumbnail?.url,
          });
        }
      } catch (error) {
        logger.warn('Failed to convert Spotify track', { track: track.name });
      }
    }

    return tracks;
  }

  /**
   * Get SoundCloud track
   */
  private async getSoundCloudTrack(url: string, requestedBy: string): Promise<Track | null> {
    const info = await play.soundcloud(url);

    if (!info || info.type !== 'track') {
      return null;
    }

    return {
      title: info.name,
      url: info.url,
      duration: info.durationInSec,
      platform: 'soundcloud',
      requestedBy,
      thumbnail: info.thumbnail,
    };
  }

  /**
   * Get SoundCloud playlist
   */
  private async getSoundCloudPlaylist(url: string, requestedBy: string): Promise<Track[]> {
    const info = await play.soundcloud(url);

    if (!info || info.type !== 'playlist') {
      return [];
    }

    return info.tracks.map((track) => ({
      title: track.name,
      url: track.url,
      duration: track.durationInSec,
      platform: 'soundcloud',
      requestedBy,
      thumbnail: track.thumbnail,
    }));
  }

  /**
   * Create audio resource for streaming
   */
  async createAudioStream(track: Track) {
    try {
      logger.info('Creating audio stream', { title: track.title, platform: track.platform });

      const stream = await play.stream(track.url, {
        discordPlayerCompatibility: true,
      });

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });

      return resource;
    } catch (error) {
      logger.error('Failed to create audio stream', { error, track });
      throw error;
    }
  }

  /**
   * Search for tracks
   */
  async search(query: string, limit: number = 5): Promise<Track[]> {
    try {
      const results = await play.search(query, { limit, source: { youtube: 'video' } });

      return results.map((video) => ({
        title: video.title || 'Unknown',
        url: video.url,
        duration: video.durationInSec,
        platform: 'youtube',
        requestedBy: '',
        thumbnail: video.thumbnails[0]?.url,
      }));
    } catch (error) {
      logger.error('Search failed', { error, query });
      return [];
    }
  }
}
