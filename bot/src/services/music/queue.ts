import { Track } from './streaming';
import { logger } from '../../utils/logger';

export enum LoopMode {
  OFF = 'off',
  TRACK = 'track',
  QUEUE = 'queue',
}

export class MusicQueue {
  private guildId: string;
  private tracks: Track[];
  private currentTrack: Track | null;
  private loopMode: LoopMode;
  private volume: number;
  private originalQueue: Track[]; // For queue loop

  constructor(guildId: string) {
    this.guildId = guildId;
    this.tracks = [];
    this.currentTrack = null;
    this.loopMode = LoopMode.OFF;
    this.volume = 50;
    this.originalQueue = [];
  }

  /**
   * Add a track to the queue
   */
  add(track: Track): void {
    this.tracks.push(track);
    logger.debug('Track added to queue', { guildId: this.guildId, title: track.title });
  }

  /**
   * Add multiple tracks to the queue
   */
  addMultiple(tracks: Track[]): void {
    this.tracks.push(...tracks);
    logger.debug('Multiple tracks added to queue', {
      guildId: this.guildId,
      count: tracks.length,
    });
  }

  /**
   * Get the next track
   */
  next(): Track | null {
    // Handle track loop
    if (this.loopMode === LoopMode.TRACK && this.currentTrack) {
      return this.currentTrack;
    }

    // Get next track from queue
    const track = this.tracks.shift() || null;

    // Handle queue loop
    if (this.loopMode === LoopMode.QUEUE) {
      if (this.currentTrack) {
        this.originalQueue.push(this.currentTrack);
      }

      // If queue is empty and we have original tracks, restore them
      if (track === null && this.originalQueue.length > 0) {
        this.tracks = [...this.originalQueue];
        this.originalQueue = [];
        return this.tracks.shift() || null;
      }
    }

    this.currentTrack = track;
    return track;
  }

  /**
   * Get current track
   */
  getCurrent(): Track | null {
    return this.currentTrack;
  }

  /**
   * Get all tracks in queue
   */
  getTracks(): Track[] {
    return this.tracks;
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.tracks.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.tracks.length === 0;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.tracks = [];
    this.currentTrack = null;
    this.originalQueue = [];
    logger.debug('Queue cleared', { guildId: this.guildId });
  }

  /**
   * Remove a track by index
   */
  remove(index: number): Track | null {
    if (index < 0 || index >= this.tracks.length) {
      return null;
    }

    const removed = this.tracks.splice(index, 1);
    return removed[0] || null;
  }

  /**
   * Shuffle the queue
   */
  shuffle(): void {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
    logger.debug('Queue shuffled', { guildId: this.guildId });
  }

  /**
   * Set loop mode
   */
  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;

    // Initialize original queue for queue loop
    if (mode === LoopMode.QUEUE && this.originalQueue.length === 0) {
      this.originalQueue = [...this.tracks];
      if (this.currentTrack) {
        this.originalQueue.unshift(this.currentTrack);
      }
    }

    // Clear original queue if loop is turned off
    if (mode === LoopMode.OFF) {
      this.originalQueue = [];
    }

    logger.debug('Loop mode changed', { guildId: this.guildId, mode });
  }

  /**
   * Get loop mode
   */
  getLoopMode(): LoopMode {
    return this.loopMode;
  }

  /**
   * Set volume
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    logger.debug('Volume changed', { guildId: this.guildId, volume: this.volume });
  }

  /**
   * Get volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Get queue duration in seconds
   */
  getTotalDuration(): number {
    return this.tracks.reduce((total, track) => total + track.duration, 0);
  }

  /**
   * Get paginated tracks for display
   */
  getPaginated(page: number = 1, perPage: number = 10): { tracks: Track[]; totalPages: number } {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const totalPages = Math.ceil(this.tracks.length / perPage);

    return {
      tracks: this.tracks.slice(start, end),
      totalPages: totalPages || 1,
    };
  }
}
