import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { config } from '../../config/constants';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

export interface Voice {
  name: string;
  duration: number;
  file_path: string;
}

export class TTSClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.services.ttsServiceUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Register a new voice for a user
   */
  async registerVoice(
    userId: string,
    voiceName: string,
    audioFilePath: string,
    language: string = 'en'
  ): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('voice_name', voiceName);
      formData.append('language', language);
      formData.append('audio_file', fs.createReadStream(audioFilePath));

      const response = await this.client.post('/register-voice', formData, {
        headers: formData.getHeaders(),
      });

      logger.info('Voice registered successfully', { userId, voiceName });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to register voice', {
        error: error.response?.data || error.message,
        userId,
        voiceName,
      });
      throw new Error(error.response?.data?.detail || 'Failed to register voice');
    }
  }

  /**
   * Synthesize speech from text
   */
  async synthesize(
    userId: string,
    text: string,
    voiceName?: string,
    language: string = 'en',
    speed: number = 1.0
  ): Promise<Buffer> {
    try {
      const response = await this.client.post(
        '/synthesize',
        {
          user_id: userId,
          text: text,
          voice_name: voiceName,
          language: language,
          speed: speed,
        },
        {
          responseType: 'arraybuffer',
        }
      );

      logger.info('Speech synthesized successfully', { userId, textLength: text.length });
      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('Failed to synthesize speech', {
        error: error.response?.data || error.message,
        userId,
      });
      throw new Error(error.response?.data?.detail || 'Failed to synthesize speech');
    }
  }

  /**
   * List all voices for a user
   */
  async listVoices(userId: string): Promise<Voice[]> {
    try {
      const response = await this.client.get(`/voices/${userId}`);
      return response.data.voices || [];
    } catch (error: any) {
      logger.error('Failed to list voices', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Delete a voice
   */
  async deleteVoice(userId: string, voiceName: string): Promise<void> {
    try {
      await this.client.delete(`/voices/${userId}/${voiceName}`);
      logger.info('Voice deleted successfully', { userId, voiceName });
    } catch (error: any) {
      logger.error('Failed to delete voice', { error: error.message, userId, voiceName });
      throw new Error('Failed to delete voice');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      logger.error('TTS service health check failed', error);
      return false;
    }
  }
}
