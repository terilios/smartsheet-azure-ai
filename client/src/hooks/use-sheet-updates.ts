import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

interface SheetUpdate {
  type: "sheet_update";
  sheetId: string;
  change: {
    type: "sheet" | "row";
    action: "created" | "updated" | "deleted";
    id: string;
    timestamp: string;
  };
}

export function useSheetUpdates(sheetId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUpdate = useCallback((event: SheetUpdate) => {
    // Invalidate queries that depend on this sheet
    queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
    
    // Show toast notification
    toast({
      title: "Sheet Updated",
      description: `${event.change.type} ${event.change.action} at ${new Date(event.change.timestamp).toLocaleTimeString()}`,
    });
  }, [queryClient, toast]);

  useEffect(() => {
    if (!sheetId) return;

    // Create WebSocket connection
    const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:3000`;
    const ws = new WebSocket(wsUrl);
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      ws.addEventListener("open", () => {
        console.log("WebSocket connected");
        // Subscribe to sheet updates
        ws.send(JSON.stringify({
          type: "subscribe",
          sheetId
        }));
      });

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "sheet_update") {
            handleUpdate(data);
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      });

      ws.addEventListener("close", () => {
        console.log("WebSocket disconnected, attempting to reconnect...");
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000);
      });

      ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
      });
    };

    connect();

    // Cleanup on unmount
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [sheetId, handleUpdate]);
}
