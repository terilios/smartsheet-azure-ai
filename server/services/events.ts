/**
 * Server-side event system for centralized event management
 */

// Event types for the server
export enum ServerEventType {
  // Sheet events
  SHEET_DATA_UPDATED = 'SHEET_DATA_UPDATED',
  SHEET_CELL_UPDATED = 'SHEET_CELL_UPDATED',
  SHEET_ROW_ADDED = 'SHEET_ROW_ADDED',
  SHEET_ROW_DELETED = 'SHEET_ROW_DELETED',
  SHEET_ROW_UPDATED = 'SHEET_ROW_UPDATED',
  SHEET_COLUMN_ADDED = 'SHEET_COLUMN_ADDED',
  SHEET_COLUMN_DELETED = 'SHEET_COLUMN_DELETED',
  SHEET_COLUMN_UPDATED = 'SHEET_COLUMN_UPDATED',
  
  // Session events
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_UPDATED = 'SESSION_UPDATED',
  SESSION_DELETED = 'SESSION_DELETED',
  SESSION_STATE_CHANGED = 'SESSION_STATE_CHANGED',
  
  // Message events
  MESSAGE_ADDED = 'MESSAGE_ADDED',
  
  // Job events
  JOB_CREATED = 'JOB_CREATED',
  JOB_UPDATED = 'JOB_UPDATED',
  JOB_COMPLETED = 'JOB_COMPLETED',
  JOB_FAILED = 'JOB_FAILED',
  
  // Cache events
  CACHE_INVALIDATED = 'CACHE_INVALIDATED',
  CACHE_UPDATED = 'CACHE_UPDATED',
  
  // WebSocket events
  WS_CLIENT_CONNECTED = 'WS_CLIENT_CONNECTED',
  WS_CLIENT_DISCONNECTED = 'WS_CLIENT_DISCONNECTED',
  WS_CLIENT_SUBSCRIBED = 'WS_CLIENT_SUBSCRIBED',
  WS_CLIENT_UNSUBSCRIBED = 'WS_CLIENT_UNSUBSCRIBED',
  
  // System events
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_WARNING = 'SYSTEM_WARNING',
  SYSTEM_INFO = 'SYSTEM_INFO',

  // Smartsheet events
  SMARTSHEET_INITIALIZED = 'SMARTSHEET_INITIALIZED',
  SMARTSHEET_ERROR = 'SMARTSHEET_ERROR',
  SMARTSHEET_TOKEN_VERIFIED = 'SMARTSHEET_TOKEN_VERIFIED',
  SMARTSHEET_TOKEN_INVALID = 'SMARTSHEET_TOKEN_INVALID',
  SMARTSHEET_SHEET_ACCESS_GRANTED = 'SMARTSHEET_SHEET_ACCESS_GRANTED',
  SMARTSHEET_SHEET_ACCESS_DENIED = 'SMARTSHEET_SHEET_ACCESS_DENIED'
}

/**
 * Event payload interface
 */
export interface ServerEventPayload<T = any> {
  type: ServerEventType;
  data: T;
  timestamp: number;
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * Event listener type
 */
export type ServerEventListener<T = any> = (payload: ServerEventPayload<T>) => void;

/**
 * Server-side event bus for cross-component communication
 */
class ServerEventBus {
  private listeners: Map<ServerEventType, Set<ServerEventListener>> = new Map();
  private wildcardListeners: Set<ServerEventListener> = new Set();
  private history: Map<ServerEventType, ServerEventPayload[]> = new Map();
  private historyLimit = 50;
  private debug = false;

  /**
   * Subscribe to an event
   * @param eventType The event type to subscribe to
   * @param listener The listener function
   * @returns A function to unsubscribe
   */
  subscribe<T = any>(eventType: ServerEventType, listener: ServerEventListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener as ServerEventListener);
    
    // Return unsubscribe function
    return () => this.unsubscribe(eventType, listener as ServerEventListener);
  }

  /**
   * Subscribe to all events
   * @param listener The listener function
   * @returns A function to unsubscribe
   */
  subscribeToAll<T = any>(listener: ServerEventListener<T>): () => void {
    this.wildcardListeners.add(listener as ServerEventListener);
    
    // Return unsubscribe function
    return () => this.unsubscribeFromAll(listener as ServerEventListener);
  }

  /**
   * Unsubscribe from an event
   * @param eventType The event type to unsubscribe from
   * @param listener The listener function to remove
   */
  unsubscribe(eventType: ServerEventType, listener: ServerEventListener): void {
    if (!this.listeners.has(eventType)) return;
    
    const listeners = this.listeners.get(eventType)!;
    listeners.delete(listener);
    
    if (listeners.size === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Unsubscribe from all events
   * @param listener The listener function to remove
   */
  unsubscribeFromAll(listener: ServerEventListener): void {
    this.wildcardListeners.delete(listener);
  }

  /**
   * Publish an event
   * @param eventType The event type to publish
   * @param data The event data
   * @param source Optional source identifier
   * @param metadata Optional additional metadata
   */
  publish<T = any>(
    eventType: ServerEventType, 
    data: T, 
    source?: string,
    metadata?: Record<string, any>
  ): void {
    const payload: ServerEventPayload<T> = {
      type: eventType,
      data,
      timestamp: Date.now(),
      source,
      metadata
    };
    
    if (this.debug) {
      console.log(`[ServerEventBus] Publishing event: ${eventType}`, {
        source,
        data: typeof data === 'object' ? '(object)' : data,
        timestamp: new Date(payload.timestamp).toISOString()
      });
    }
    
    // Store in history
    if (!this.history.has(eventType)) {
      this.history.set(eventType, []);
    }
    
    const eventHistory = this.history.get(eventType)!;
    eventHistory.push(payload);
    
    // Limit history size
    if (eventHistory.length > this.historyLimit) {
      eventHistory.shift();
    }
    
    // Notify specific listeners
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
    
    // Notify wildcard listeners
    this.wildcardListeners.forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in wildcard event listener for ${eventType}:`, error);
      }
    });
  }

  /**
   * Get event history
   * @param eventType The event type to get history for
   * @returns Array of event payloads
   */
  getHistory<T = any>(eventType: ServerEventType): ServerEventPayload<T>[] {
    return (this.history.get(eventType) || []) as ServerEventPayload<T>[];
  }

  /**
   * Clear event history
   * @param eventType Optional event type to clear history for
   */
  clearHistory(eventType?: ServerEventType): void {
    if (eventType) {
      this.history.delete(eventType);
    } else {
      this.history.clear();
    }
  }

  /**
   * Get the current history limit
   * @returns The current history limit
   */
  getHistoryLimit(): number {
    return this.historyLimit;
  }

  /**
   * Set history limit
   * @param limit The maximum number of events to keep in history
   */
  setHistoryLimit(limit: number): void {
    this.historyLimit = limit;
    
    // Trim existing histories
    this.history.forEach((events, type) => {
      if (events.length > limit) {
        this.history.set(type, events.slice(-limit));
      }
    });
  }

  /**
   * Enable or disable debug logging
   * @param enabled Whether debug logging should be enabled
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}

// Create and export a singleton instance
export const serverEventBus = new ServerEventBus();