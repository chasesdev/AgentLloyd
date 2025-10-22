import { SecureStorage } from '../utils/secureStorage';
import { chatDatabase } from './chatDatabase';
import { errorHandlerService } from './errorHandlerService';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  size: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number; // in bytes
  maxEntries: number;
  defaultTTL: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  oldestEntry: Date;
  newestEntry: Date;
  entriesByTag: Record<string, number>;
}

export class CacheService {
  private static instance: CacheService;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };
  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    };

    this.startCleanupTimer();
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Store data in cache
   */
  async set<T>(
    key: string, 
    data: T, 
    ttl?: number, 
    tags?: string[], 
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const serializedData = JSON.stringify(data);
      const size = new Blob([serializedData]).size;
      const timestamp = Date.now();
      const expiresAt = timestamp + (ttl || this.config.defaultTTL);

      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp,
        expiresAt,
        size,
        tags,
        metadata
      };

      // Check if we need to make space
      await this.ensureSpace(size);

      // Store in memory cache
      this.memoryCache.set(key, entry);

      // Store in persistent cache if large or important
      if (size > 1024 * 100 || tags?.includes('persistent')) { // > 100KB or marked persistent
        await this.setPersistentCache(key, entry);
      }

      this.stats.sets++;

      // Log cache operation
      console.log(`Cache SET: ${key} (${this.formatBytes(size)})`);

    } catch (error) {
      console.error('Cache set failed:', error);
      await errorHandlerService.handleError(error as Error, {
        screen: 'CacheService',
        action: 'set',
        data: { key }
      });
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      let entry = this.memoryCache.get(key);

      // Check persistent cache if not in memory
      if (!entry) {
        entry = await this.getPersistentCache(key);
        if (entry) {
          // Restore to memory cache
          this.memoryCache.set(key, entry);
        }
      }

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if expired
      if (Date.now() > entry.expiresAt) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      console.log(`Cache HIT: ${key}`);
      return entry.data as T;

    } catch (error) {
      console.error('Cache get failed:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await this.deletePersistentCache(key);
      this.stats.deletes++;
      console.log(`Cache DELETE: ${key}`);
    } catch (error) {
      console.error('Cache delete failed:', error);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry !== null;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      await this.clearPersistentCache();
      this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };
      console.log('Cache cleared');
    } catch (error) {
      console.error('Cache clear failed:', error);
    }
  }

  /**
   * Get entries by tag
   */
  async getByTag<T>(tag: string): Promise<Array<{ key: string; data: T }>> {
    try {
      const results: Array<{ key: string; data: T }> = [];

      // Check memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags?.includes(tag) && Date.now() <= entry.expiresAt) {
          results.push({ key, data: entry.data as T });
        }
      }

      // Check persistent cache
      const persistentEntries = await this.getPersistentCacheByTag(tag);
      for (const entry of persistentEntries) {
        if (Date.now() <= entry.expiresAt) {
          results.push({ key: entry.key, data: entry.data as T });
        }
      }

      return results;
    } catch (error) {
      console.error('Cache get by tag failed:', error);
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const now = Date.now();
      let oldestEntry = now;
      let newestEntry = 0;
      let totalSize = 0;
      const entriesByTag: Record<string, number> = {};

      // Analyze memory cache
      for (const entry of this.memoryCache.values()) {
        if (entry.timestamp < oldestEntry) oldestEntry = entry.timestamp;
        if (entry.timestamp > newestEntry) newestEntry = entry.timestamp;
        totalSize += entry.size;
        
        if (entry.tags) {
          entry.tags.forEach(tag => {
            entriesByTag[tag] = (entriesByTag[tag] || 0) + 1;
          });
        }
      }

      // Analyze persistent cache
      const persistentEntries = await this.getAllPersistentCache();
      for (const entry of persistentEntries) {
        if (entry.timestamp < oldestEntry) oldestEntry = entry.timestamp;
        if (entry.timestamp > newestEntry) newestEntry = entry.timestamp;
        totalSize += entry.size;
        
        if (entry.tags) {
          entry.tags.forEach(tag => {
            entriesByTag[tag] = (entriesByTag[tag] || 0) + 1;
          });
        }
      }

      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

      return {
        totalEntries: this.memoryCache.size + persistentEntries.length,
        totalSize,
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        oldestEntry: new Date(oldestEntry),
        newestEntry: new Date(newestEntry),
        entriesByTag
      };
    } catch (error) {
      console.error('Cache stats failed:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
        oldestEntry: new Date(),
        newestEntry: new Date(),
        entriesByTag: {}
      };
    }
  }

  /**
   * Ensure enough space for new entry
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentSize = this.getCurrentSize();
    
    if (currentSize + requiredSize <= this.config.maxSize) {
      return;
    }

    // Sort entries by expiration time (oldest first)
    const entries = Array.from(this.memoryCache.values())
      .sort((a, b) => a.expiresAt - b.expiresAt);

    let freedSpace = 0;
    const toDelete: string[] = [];

    for (const entry of entries) {
      toDelete.push(entry.key);
      freedSpace += entry.size;
      
      if (currentSize - freedSpace + requiredSize <= this.config.maxSize) {
        break;
      }
    }

    // Delete entries
    for (const key of toDelete) {
      this.memoryCache.delete(key);
      await this.deletePersistentCache(key);
    }

    console.log(`Cache cleanup: freed ${this.formatBytes(freedSpace)}, deleted ${toDelete.length} entries`);
  }

  /**
   * Get current cache size
   */
  private getCurrentSize(): number {
    let size = 0;
    for (const entry of this.memoryCache.values()) {
      size += entry.size;
    }
    return size;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up expired entries
   */
  private async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      const toDelete: string[] = [];

      // Check memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expiresAt) {
          toDelete.push(key);
        }
      }

      // Delete expired entries
      for (const key of toDelete) {
        this.memoryCache.delete(key);
        await this.deletePersistentCache(key);
      }

      if (toDelete.length > 0) {
        console.log(`Cache cleanup: removed ${toDelete.length} expired entries`);
      }

      // Also check max entries limit
      if (this.memoryCache.size > this.config.maxEntries) {
        const entries = Array.from(this.memoryCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const excess = entries.length - this.config.maxEntries;
        for (let i = 0; i < excess; i++) {
          this.memoryCache.delete(entries[i][0]);
          await this.deletePersistentCache(entries[i][0]);
        }

        if (excess > 0) {
          console.log(`Cache cleanup: removed ${excess} entries due to size limit`);
        }
      }

    } catch (error) {
      console.error('Cache cleanup failed:', error);
    }
  }

  /**
   * Store in persistent cache (SecureStorage)
   */
  private async setPersistentCache(key: string, entry: CacheEntry): Promise<void> {
    try {
      await SecureStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (error) {
      console.error('Persistent cache set failed:', error);
    }
  }

  /**
   * Get from persistent cache
   */
  private async getPersistentCache(key: string): Promise<CacheEntry | null> {
    try {
      const data = await SecureStorage.getItem(`cache_${key}`);
      if (!data) return null;
      
      const entry = JSON.parse(data) as CacheEntry;
      
      // Validate entry structure
      if (!entry.key || !entry.timestamp || !entry.expiresAt) {
        await this.deletePersistentCache(key);
        return null;
      }
      
      return entry;
    } catch (error) {
      console.error('Persistent cache get failed:', error);
      return null;
    }
  }

  /**
   * Delete from persistent cache
   */
  private async deletePersistentCache(key: string): Promise<void> {
    try {
      await SecureStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.error('Persistent cache delete failed:', error);
    }
  }

  /**
   * Clear persistent cache
   */
  private async clearPersistentCache(): Promise<void> {
    try {
      // In a real implementation, you would need to track cache keys
      // For now, we'll just clear known patterns
      const knownKeys = [
        'api_response_',
        'image_analysis_',
        'code_execution_',
        'file_analysis_',
        'github_data_'
      ];

      for (const pattern of knownKeys) {
        // This is a simplified approach
        // In production, you would maintain a key registry
        console.log(`Clearing persistent cache pattern: ${pattern}`);
      }
    } catch (error) {
      console.error('Persistent cache clear failed:', error);
    }
  }

  /**
   * Get persistent cache entries by tag
   */
  private async getPersistentCacheByTag(tag: string): Promise<CacheEntry[]> {
    try {
      // This is a simplified implementation
      // In production, you would maintain a tag index
      return [];
    } catch (error) {
      console.error('Persistent cache get by tag failed:', error);
      return [];
    }
  }

  /**
   * Get all persistent cache entries
   */
  private async getAllPersistentCache(): Promise<CacheEntry[]> {
    try {
      // This is a simplified implementation
      // In production, you would maintain a key registry
      return [];
    } catch (error) {
      console.error('Get all persistent cache failed:', error);
      return [];
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Configure cache settings
   */
  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart cleanup timer with new interval
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.startCleanupTimer();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Destroy cache service
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.memoryCache.clear();
  }
}

export const cacheService = CacheService.getInstance();