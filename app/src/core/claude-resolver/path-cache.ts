/**
 * Claude Path Cache - Persistent file-based caching
 * Follows Single Responsibility Principle
 */
import { promises as fs } from 'fs';
import * as path from 'path';
import os from 'os';
import { logger } from '../../utils/logger';
import { IClaudePathCache } from './interfaces';

export class ClaudePathCache implements IClaudePathCache {
  private static instance: ClaudePathCache | null = null;
  private readonly cacheFilePath: string;
  private cachedPath: string | null = null;
  private isLoaded = false;

  private constructor() {
    const cacheDir = path.join(os.homedir(), '.claude-wrapper');
    this.cacheFilePath = path.join(cacheDir, 'claude-path.cache');
  }

  static getInstance(): ClaudePathCache {
    if (!ClaudePathCache.instance) {
      ClaudePathCache.instance = new ClaudePathCache();
    }
    return ClaudePathCache.instance;
  }

  async get(): Promise<string | null> {
    if (!this.isLoaded) {
      await this.loadFromFile();
    }
    return this.cachedPath;
  }

  async set(claudePath: string): Promise<void> {
    this.cachedPath = claudePath;
    this.isLoaded = true;
    await this.saveToFile(claudePath);
    logger.info('Claude path cached', { path: claudePath });
  }

  async clear(): Promise<void> {
    this.cachedPath = null;
    this.isLoaded = true;
    try {
      await fs.unlink(this.cacheFilePath);
      logger.info('Claude path cache cleared');
    } catch (error) {
      // File doesn't exist, that's fine
      logger.debug('Cache file does not exist, nothing to clear');
    }
  }

  private async loadFromFile(): Promise<void> {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf-8');
      const cached = JSON.parse(data);
      
      // Validate cache is not too old (24 hours)
      const cacheAge = Date.now() - cached.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < maxAge) {
        this.cachedPath = cached.path;
        logger.debug('Claude path loaded from cache', { path: cached.path, age: cacheAge });
      } else {
        logger.debug('Cache expired, will need to rediscover path', { age: cacheAge });
        await this.clear();
      }
    } catch (error) {
      logger.debug('No valid cache file found, will discover path');
      this.cachedPath = null;
    }
    this.isLoaded = true;
  }

  private async saveToFile(claudePath: string): Promise<void> {
    try {
      const cacheDir = path.dirname(this.cacheFilePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const data = JSON.stringify({
        path: claudePath,
        timestamp: Date.now(),
        version: '1.0.0'
      }, null, 2);
      
      await fs.writeFile(this.cacheFilePath, data, 'utf-8');
      logger.debug('Claude path saved to cache file', { cacheFile: this.cacheFilePath });
    } catch (error) {
      logger.warn('Failed to save cache file', { error });
    }
  }
}