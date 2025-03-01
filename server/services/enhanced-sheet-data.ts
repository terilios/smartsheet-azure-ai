import { storage } from "../storage.js";
import { getSheetInfo, verifySheetAccess } from "../tools/smartsheet.js";
import { serverEventBus, ServerEventType } from "./events.js";
import { enhancedSheetCache } from "./enhanced-cache.js";

/**
 * Enhanced service for managing sheet data updates with event system integration
 */
export class EnhancedSheetDataService {
  private static instance: EnhancedSheetDataService;
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();
  private refreshInterval: number = 5 * 60 * 1000; // 5 minutes by default
  private sessionSheetMap: Map<string, string> = new Map(); // sessionId -> sheetId

  private constructor() {
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for sheet data coordination
   */
  private setupEventListeners() {
    // Listen for session state changes
    serverEventBus.subscribe(ServerEventType.SESSION_STATE_CHANGED, (event) => {
      const { sessionId, state } = event.data;
      
      // If session is closed or in error state, stop refreshing
      if (state === "CLOSED" || state === "ERROR") {
        this.stopPeriodicRefresh(sessionId);
      }
    });

    // Listen for cache invalidation events
    serverEventBus.subscribe(ServerEventType.CACHE_INVALIDATED, (event) => {
      const { sheetId, source } = event.data;
      
      // Don't react to our own events to avoid loops
      if (source === 'sheet-data-service') {
        return;
      }
      
      // Find all sessions using this sheet and refresh their data
      for (const [sessionId, mappedSheetId] of this.sessionSheetMap.entries()) {
        if (mappedSheetId === sheetId) {
          this.loadSheetData(sessionId, sheetId, true)
            .catch(error => {
              console.error(`Error refreshing sheet data after cache invalidation for session ${sessionId}:`, error);
            });
        }
      }
    });
  }

  /**
   * Get the singleton instance of EnhancedSheetDataService
   */
  public static getInstance(): EnhancedSheetDataService {
    if (!EnhancedSheetDataService.instance) {
      EnhancedSheetDataService.instance = new EnhancedSheetDataService();
    }
    return EnhancedSheetDataService.instance;
  }

  /**
   * Set the refresh interval for sheet data updates
   * @param interval Interval in milliseconds
