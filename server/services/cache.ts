import { type SheetData } from "../../shared/schema";

interface CacheEntry {
  data: SheetData;
  timestamp: number;
  version?: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string;
}

export class SheetCache {
  private cache: Map<string, CacheEntry>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default TTL

  constructor() {
    this.cache = new Map();
  }

  /**
   * Store sheet data in cache
   */
  set(sheetId: string, data: SheetData, options: CacheOptions = {}): void {
    const { ttl = this.DEFAULT_TTL, version } = options;
    
    this.cache.set(sheetId, {
      data,
      timestamp: Date.now(),
      version
    });

    // Set up automatic cache invalidation
    if (ttl > 0) {
      setTimeout(() => {
        this.invalidate(sheetId);
      }, ttl);
    }
  }

  /**
   * Retrieve sheet data from cache
   */
  get(sheetId: string): SheetData | null {
    const entry = this.cache.get(sheetId);
    
    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL) {
      this.invalidate(sheetId);
      return null;
    }

    return entry.data;
  }

  /**
   * Check if sheet data exists in cache and is valid
   */
  has(sheetId: string, version?: string): boolean {
    const entry = this.cache.get(sheetId);
    
    if (!entry) {
      return false;
    }

    // If version is provided, check if cache version matches
    if (version && entry.version !== version) {
      return false;
    }

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > this.DEFAULT_TTL) {
      this.invalidate(sheetId);
      return false;
    }

    return true;
  }

  /**
   * Remove sheet data from cache
   */
  invalidate(sheetId: string): void {
    this.cache.delete(sheetId);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Update specific rows in cached sheet data
   */
  updateRows(sheetId: string, rowUpdates: Array<{ id: string; [key: string]: any }>): boolean {
    const entry = this.cache.get(sheetId);
    
    if (!entry) {
      return false;
    }

    const updatedRows = entry.data.rows.map(row => {
      const update = rowUpdates.find(u => u.id === row.id);
      if (update) {
        return { ...row, ...update };
      }
      return row;
    });

    entry.data.rows = updatedRows;
    entry.timestamp = Date.now(); // Reset TTL on update
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; averageAge: number } {
    const now = Date.now();
    let totalAge = 0;
    let count = 0;

    this.cache.forEach(entry => {
      totalAge += now - entry.timestamp;
      count++;
    });

    return {
      size: this.cache.size,
      averageAge: count > 0 ? totalAge / count : 0
    };
  }
}

// Export singleton instance
export const sheetCache = new SheetCache();
