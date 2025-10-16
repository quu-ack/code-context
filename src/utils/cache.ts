import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIContext } from '../analyzers/ai-analyzer.js';

export interface CacheEntry {
  context: AIContext;
  fileHash: string;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class CacheManager {
  private cacheDir: string;
  private defaultTTL: number;

  constructor(cacheDir?: string, ttl: number = 7 * 24 * 60 * 60 * 1000) {
    // Default: 7 days
    this.cacheDir = cacheDir || path.join(process.cwd(), '.code-context-cache');
    this.defaultTTL = ttl;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCacheKey(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  private getFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  }

  async get(filePath: string): Promise<AIContext | null> {
    const key = this.getCacheKey(filePath);
    const cachePath = this.getCachePath(key);

    if (!fs.existsSync(cachePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(cachePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(data);

      // Check if cache is expired
      const now = Date.now();
      if (now - entry.timestamp > entry.ttl) {
        this.invalidate(filePath);
        return null;
      }

      // Check if file has changed
      const currentHash = this.getFileHash(filePath);
      if (currentHash && currentHash !== entry.fileHash) {
        this.invalidate(filePath);
        return null;
      }

      return entry.context;
    } catch (error) {
      // Cache corrupted, remove it
      this.invalidate(filePath);
      return null;
    }
  }

  async set(filePath: string, context: AIContext): Promise<void> {
    const key = this.getCacheKey(filePath);
    const cachePath = this.getCachePath(key);
    const fileHash = this.getFileHash(filePath);

    const entry: CacheEntry = {
      context,
      fileHash,
      timestamp: Date.now(),
      ttl: this.defaultTTL,
    };

    try {
      fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to write cache for ${filePath}:`, error);
    }
  }

  invalidate(filePath: string): void {
    const key = this.getCacheKey(filePath);
    const cachePath = this.getCachePath(key);

    try {
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      console.warn(`Failed to invalidate cache for ${filePath}:`, error);
    }
  }

  clear(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.cacheDir, file));
        });
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  getStats(): { size: number; files: number } {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return { size: 0, files: 0 };
      }

      const files = fs.readdirSync(this.cacheDir);
      let totalSize = 0;

      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      });

      return {
        size: totalSize,
        files: files.length,
      };
    } catch {
      return { size: 0, files: 0 };
    }
  }
}
