import { type SheetData } from "../../shared/schema";
import { serverEventBus, ServerEventType } from "./events.js";

interface CacheEntry {
  data: SheetData;
  timestamp: number;
  version?: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string;
  source?: string; // Source of the cache update
}

/**
 * Enhanced sheet cache with event system integration
 */
export class EnhancedSheetCache {
  private cache: Map<string, CacheEntry>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default TTL

  constructor() {
    this.cache = new Map();
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for cache coordination
   */
  private setupEventListeners() {
    // Listen for sheet data updates
    serverEventBus.subscribe(ServerEventType.SHEET_DATA_UPDATED, (event) => {
      const { sheetId } = event.data;
      if (sheetId) {
        this.invalidate(sheetId, event.source);
      }
    });

    // Listen for row updates
    serverEventBus.subscribe(ServerEventType.SHEET_ROW_UPDATED, (event) => {
      const { sheetId, rowId, data } = event.data;
      if (sheetId && rowId) {
        if (data) {
          this.updateRows(sheetId, [{ id: rowId, ...data }], event.source);
        } else {
          // If no data provided, invalidate the cache
          this.invalidate(sheetId, event.source);
        }
      }
    });

    // Listen for row additions
    serverEventBus.subscribe(ServerEventType.SHEET_ROW_ADDED, (event) => {
      // Row additions require a full refresh since we don't have the complete row data
      const { sheetId } = event.data;
      if (sheetId) {
        this.invalidate(sheetId, event.source);
      }
    });

    // Listen for row deletions
    serverEventBus.subscribe(ServerEventType.SHEET_ROW_DELETED, (event) => {
      const { sheetId, rowId } = event.data;
      if (sheetId && rowId) {
        this.removeRow(sheetId, rowId, event.source);
      }
    });
  }

  /**
   * Store sheet data in cache
   */
  set(sheetId: string, data: SheetData, options: CacheOptions = {}): void {
    const { ttl = this.DEFAULT_TTL, version, source } = options;
    
    this.cache.set(sheetId, {
      data,
      timestamp: Date.now(),
      version
    });

    // Publish cache updated event
    serverEventBus.publish(ServerEventType.CACHE_UPDATED, {
      sheetId,
      action: 'set',
      timestamp: new Date().toISOString(),
      source: source || 'cache'
    });

    // Set up automatic cache invalidation
    if (ttl > 0) {
      setTimeout(() => {
        this.invalidate(sheetId, 'ttl-expiration');
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
      this.invalidate(sheetId, 'get-expiration');
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
      this.invalidate(sheetId, 'has-expiration');
      return false;
    }

    return true;
  }

  /**
   * Remove sheet data from cache
   */
  invalidate(sheetId: string, source?: string): void {
    if (this.cache.has(sheetId)) {
      this.cache.delete(sheetId);
      
      // Publish cache invalidation event
      serverEventBus.publish(ServerEventType.CACHE_INVALIDATED, {
        sheetId,
        action: 'invalidate',
        timestamp: new Date().toISOString(),
        source: source || 'cache'
      });
    }
  }

  /**
   * Clear all cached data
   */
  clear(source?: string): void {
    const sheetIds = Array.from(this.cache.keys());
    this.cache.clear();
    
    // Publish cache clear event
    serverEventBus.publish(ServerEventType.CACHE_INVALIDATED, {
      action: 'clear',
      affectedSheets: sheetIds,
      timestamp: new Date().toISOString(),
      source: source || 'cache'
    });
  }

  /**
   * Update specific rows in cached sheet data
   */
  updateRows(sheetId: string, rowUpdates: Array<{ id: string; [key: string]: any }>, source?: string): boolean {
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
    
    // Publish cache updated event
    serverEventBus.publish(ServerEventType.CACHE_UPDATED, {
      sheetId,
      action: 'updateRows',
      rowIds: rowUpdates.map(row => row.id),
      timestamp: new Date().toISOString(),
      source: source || 'cache'
    });
    
    return true;
  }

  /**
   * Remove a row from cached sheet data
   */
  removeRow(sheetId: string, rowId: string, source?: string): boolean {
    const entry = this.cache.get(sheetId);
    
    if (!entry) {
      return false;
    }

    const initialLength = entry.data.rows.length;
    entry.data.rows = entry.data.rows.filter(row => row.id !== rowId);
    
    // Check if row was actually removed
    if (entry.data.rows.length === initialLength) {
      return false;
    }
    
    entry.timestamp = Date.now(); // Reset TTL on update
    
    // Publish cache updated event
    serverEventBus.publish(ServerEventType.CACHE_UPDATED, {
      sheetId,
      action: 'removeRow',
      rowId,
      timestamp: new Date().toISOString(),
      source: source || 'cache'
    });
    
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; averageAge: number; entries: Array<{ sheetId: string, age: number }> } {
    const now = Date.now();
    let totalAge = 0;
    const entries: Array<{ sheetId: string, age: number }> = [];

    this.cache.forEach((entry, sheetId) => {
      const age = now - entry.timestamp;
      totalAge += age;
      entries.push({ sheetId, age });
    });

    return {
      size: this.cache.size,
      averageAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
      entries
    };
  }
}

// Export singleton instance
export const enhancedSheetCache = new EnhancedSheetCache();