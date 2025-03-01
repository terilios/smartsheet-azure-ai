/**
 * Event types for the application
 */
export enum EventType {
  SHEET_DATA_UPDATED = 'SHEET_DATA_UPDATED',
  CELL_UPDATED = 'CELL_UPDATED',
  ROW_ADDED = 'ROW_ADDED',
  ROW_DELETED = 'ROW_DELETED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_UPDATED = 'SESSION_UPDATED',
  SESSION_DELETED = 'SESSION_DELETED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  JOB_CREATED = 'JOB_CREATED',
  JOB_UPDATED = 'JOB_UPDATED',
  JOB_COMPLETED = 'JOB_COMPLETED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  NOTIFICATION_SHOWN = 'NOTIFICATION_SHOWN',
  NOTIFICATION_REQUEST = 'NOTIFICATION_REQUEST',
  LOADING_STATE_CHANGED = 'LOADING_STATE_CHANGED'
}

/**
 * Event payload interface
 */
export interface EventPayload<T = any> {
  type: EventType;
  data: T;
  timestamp: number;
  source?: string;
}

/**
 * Event listener type
 */
export type EventListener<T = any> = (payload: EventPayload<T>) => void;

/**
 * Event bus for cross-component communication
 */
class EventBus {
  private listeners: Map<EventType, Set<EventListener>> = new Map();
  private history: Map<EventType, EventPayload[]> = new Map();
  private historyLimit = 10;

  /**
   * Subscribe to an event
   * @param eventType The event type to subscribe to
   * @param listener The listener function
   * @returns A function to unsubscribe
   */
  subscribe<T = any>(eventType: EventType, listener: EventListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener as EventListener);
    
    // Return unsubscribe function
    return () => this.unsubscribe(eventType, listener as EventListener);
  }

  /**
   * Unsubscribe from an event
   * @param eventType The event type to unsubscribe from
   * @param listener The listener function to remove
   */
  unsubscribe(eventType: EventType, listener: EventListener): void {
    if (!this.listeners.has(eventType)) return;
    
    const listeners = this.listeners.get(eventType)!;
    listeners.delete(listener);
    
    if (listeners.size === 0) {
      this.listeners.delete(eventType);
    }
  }

  /**
   * Publish an event
   * @param eventType The event type to publish
   * @param data The event data
   * @param source Optional source identifier
   */
  publish<T = any>(eventType: EventType, data: T, source?: string): void {
    const payload: EventPayload<T> = {
      type: eventType,
      data,
      timestamp: Date.now(),
      source
    };
    
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
    
    // Notify listeners
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType)!.forEach(listener => {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Get event history
   * @param eventType The event type to get history for
   * @returns Array of event payloads
   */
  getHistory<T = any>(eventType: EventType): EventPayload<T>[] {
    return (this.history.get(eventType) || []) as EventPayload<T>[];
  }

  /**
   * Clear event history
   * @param eventType Optional event type to clear history for
   */
  clearHistory(eventType?: EventType): void {
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
}

// Create and export a singleton instance
export const eventBus = new EventBus();

/**
 * React hook for using the event bus
 */
import { useEffect, useState } from 'react';

export function useEvent<T = any>(eventType: EventType): {
  lastEvent: EventPayload<T> | null;
  history: EventPayload<T>[];
  publish: (data: T, source?: string) => void;
} {
  const [lastEvent, setLastEvent] = useState<EventPayload<T> | null>(null);
  const [history, setHistory] = useState<EventPayload<T>[]>([]);
  const [historyLimit, setHistoryLimit] = useState<number>(10);
  
  // Get the history limit on mount
  useEffect(() => {
    setHistoryLimit(eventBus.getHistoryLimit());
  }, []);
  
  useEffect(() => {
    // Initialize with existing history
    setHistory(eventBus.getHistory<T>(eventType));
    
    // Subscribe to future events
    const unsubscribe = eventBus.subscribe<T>(eventType, (payload) => {
      setLastEvent(payload);
      setHistory(prev => [...prev, payload].slice(-historyLimit));
    });
    
    return unsubscribe;
  }, [eventType, historyLimit]);
  
  const publish = (data: T, source?: string) => {
    eventBus.publish(eventType, data, source);
  };
  
  return { lastEvent, history, publish };
}