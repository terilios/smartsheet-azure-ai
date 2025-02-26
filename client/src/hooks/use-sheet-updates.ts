import { useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { useSmartsheet } from "@/lib/smartsheet-context";

// Enhanced sheet update interface
interface SheetUpdate {
  type: "sheet_update";
  sheetId: string;
  operation?: string;
  target?: "sheet" | "row" | "column" | "cell";
  targetId?: string;
  timestamp?: string;
  change?: {
    type: "sheet" | "row" | "column" | "cell";
    action: "created" | "updated" | "deleted";
    id: string;
    data?: any;
    timestamp: string;
  };
}

// Create a custom event system for sheet operations
export const sheetEvents = {
  emit: (eventName: string, data: any) => {
    const event = new CustomEvent(eventName, { detail: data });
    document.dispatchEvent(event);
  },
  
  on: (eventName: string, callback: (data: any) => void) => {
    const handler = (e: CustomEvent) => callback(e.detail);
    document.addEventListener(eventName, handler as EventListener);
    return () => document.removeEventListener(eventName, handler as EventListener);
  }
};

export interface UpdateEvent {
  type: string;
  target: "sheet" | "row" | "column" | "cell";
  targetId?: string;
  action: "created" | "updated" | "deleted";
  timestamp: Date;
  data?: any;
}

export function useSheetUpdates() {
  const {
    currentSheetId,
    refreshSheetData,
    refreshRowData,
    refreshCellData,
    invalidateCache
  } = useSmartsheet();
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [updateEvent, setUpdateEvent] = useState<UpdateEvent | null>(null);

  // Helper function to capitalize first letter
  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Helper function to get update description
  const getUpdateDescription = (event: SheetUpdate): string => {
    if (event.change) {
      const time = new Date(event.change.timestamp).toLocaleTimeString();
      const type = capitalize(event.change.type);
      const action = event.change.action;
      
      if (event.change.type === 'cell') {
        return `Cell ${action} at ${time}`;
      } else if (event.change.type === 'row') {
        return `Row ${action} at ${time}`;
      } else if (event.change.type === 'column') {
        return `Column ${action} at ${time}`;
      } else {
        return `Sheet ${action} at ${time}`;
      }
    }
    return `Sheet updated at ${new Date().toLocaleTimeString()}`;
  };

  const handleUpdate = useCallback((event: SheetUpdate) => {
    // Update last update timestamp
    const timestamp = new Date(event.timestamp || event.change?.timestamp || new Date().toISOString());
    setLastUpdate(timestamp);
    
    // Create update event object
    const updateEventObj: UpdateEvent = {
      type: event.type,
      target: event.target || event.change?.type || 'sheet',
      targetId: event.targetId || event.change?.id,
      action: event.change?.action || 'updated',
      timestamp,
      data: event.change?.data
    };
    
    setUpdateEvent(updateEventObj);
    
    // Handle different update types
    if (event.target === "row" || event.change?.type === "row") {
      const rowId = event.targetId || event.change?.id;
      if (rowId && event.change?.action !== 'deleted') {
        // Perform partial refresh for the specific row
        refreshRowData(rowId);
      } else {
        // For deleted rows or when rowId is missing, refresh the whole sheet
        refreshSheetData();
      }
    } else if (event.target === "cell" || event.change?.type === "cell") {
      const cellInfo = event.targetId?.split('_') || [];
      if (cellInfo.length === 2) {
        // Refresh specific cell
        refreshCellData(cellInfo[0], cellInfo[1]);
      } else {
        // Fallback to row refresh if cell info is incomplete
        const rowId = event.change?.id;
        if (rowId) {
          refreshRowData(rowId);
        } else {
          refreshSheetData();
        }
      }
    } else {
      // Default to full refresh for other update types
      refreshSheetData();
      // Also invalidate cache for major changes
      invalidateCache();
    }
    
    // Invalidate queries that depend on this sheet
    queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    
    // Emit event for other components
    sheetEvents.emit('sheet:update', {
      sheetId: event.sheetId,
      updateType: event.target || event.change?.type || 'sheet',
      action: event.change?.action || 'updated',
      timestamp
    });
    
    // Show toast notification
    toast({
      title: `${capitalize(event.target || event.change?.type || 'Sheet')} ${event.change?.action || 'Updated'}`,
      description: getUpdateDescription(event),
    });
  }, [queryClient, toast, refreshSheetData, refreshRowData, refreshCellData, invalidateCache]);

  // Enhanced WebSocket connection with better error handling and reconnection logic
  useEffect(() => {
    if (!currentSheetId) return;

    // Create WebSocket connection
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3000`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    const baseReconnectDelay = 1000; // Start with 1 second

    const connect = () => {
      // Clean up any existing connection
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          // Ignore errors during cleanup
        }
      }

      try {
        // Create new connection
        ws = new WebSocket(wsUrl);
        
        // Set up event listeners
        const socket = ws; // Create a non-null reference
        
        socket.addEventListener("open", () => {
          console.log("WebSocket connected");
          setIsConnected(true);
          reconnectAttempts = 0; // Reset reconnect attempts on successful connection
          
          // Subscribe to sheet updates
          socket.send(JSON.stringify({
            type: "subscribe",
            sheetId: currentSheetId
          }));
          
          // Send a ping every 30 seconds to keep the connection alive
          const pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, 30000);
          
          // Clear interval when connection closes
          socket.addEventListener("close", () => clearInterval(pingInterval));
        });

        socket.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle different message types
            if (data.type === "sheet_update") {
              handleUpdate(data);
            } else if (data.type === "pong") {
              // Handle pong response if needed
              console.debug("Received pong from server");
            } else if (data.type === "error") {
              console.error("WebSocket error message:", data.error);
              toast({
                title: "WebSocket Error",
                description: data.error,
                variant: "destructive"
              });
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        });

        socket.addEventListener("close", (event) => {
          console.log(`WebSocket disconnected (code: ${event.code}, reason: ${event.reason}), attempting to reconnect...`);
          setIsConnected(false);
          
          // Implement exponential backoff for reconnection
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttempts), 30000); // Max 30 seconds
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, delay);
          } else {
            console.error(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
            toast({
              title: "Connection Error",
              description: "Failed to reconnect to the server. Please refresh the page.",
              variant: "destructive"
            });
          }
        });

        socket.addEventListener("error", (error) => {
          console.error("WebSocket error:", error);
          setIsConnected(false);
        });
      } catch (error) {
        console.error("Error creating WebSocket connection:", error);
        setIsConnected(false);
        
        // Try to reconnect after a delay
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, 5000);
      }
    };

    connect();

    // Listen for sheet update events from other components
    const unsubscribe = sheetEvents.on('sheet:update:request', (data) => {
      if (data.sheetId === currentSheetId) {
        refreshSheetData();
      }
    });

    // Cleanup on unmount
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      unsubscribe();
    };
  }, [currentSheetId, handleUpdate, toast, refreshSheetData]);
  
  return {
    lastUpdate,
    isConnected,
    refreshSheet: refreshSheetData,
    updateEvent,
    triggerUpdate: useCallback((type: string, targetId?: string) => {
      sheetEvents.emit('sheet:update:request', {
        sheetId: currentSheetId,
        type,
        targetId
      });
    }, [currentSheetId])
  };
}
