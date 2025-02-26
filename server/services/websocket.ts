import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { z } from "zod";
import { subscribeToSheet } from "../routes/webhooks.js";

// Enhanced message schemas
const subscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  sheetId: z.string()
});

const pingMessageSchema = z.object({
  type: z.literal("ping")
});

const sheetUpdateMessageSchema = z.object({
  type: z.literal("sheet_update"),
  sheetId: z.string(),
  operation: z.enum(["update", "insert", "delete"]),
  target: z.enum(["sheet", "row", "column", "cell"]).optional(),
  targetId: z.string().optional(),
  rows: z.array(z.record(z.string(), z.any())).optional(),
  columns: z.array(z.any()).optional(),
  change: z.object({
    type: z.enum(["sheet", "row", "column", "cell"]),
    action: z.enum(["created", "updated", "deleted"]),
    id: z.string(),
    data: z.any().optional(),
    timestamp: z.string()
  }).optional()
});

const messageSchema = z.discriminatedUnion("type", [
  subscribeMessageSchema,
  pingMessageSchema,
  sheetUpdateMessageSchema
]);

// Update types
export type UpdateTarget = "sheet" | "row" | "column" | "cell";
export type UpdateAction = "created" | "updated" | "deleted";

export interface SheetUpdateEvent {
  type: "sheet_update";
  sheetId: string;
  operation?: string;
  target?: UpdateTarget;
  targetId?: string;
  timestamp: string;
  change?: {
    type: UpdateTarget;
    action: UpdateAction;
    id: string;
    data?: any;
    timestamp: string;
  };
}

export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private wss: WebSocketServer;

  private constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("New WebSocket connection established");

      ws.on("message", (data: string) => {
        try {
          const message = JSON.parse(data);
          const result = messageSchema.safeParse(message);

          if (!result.success) {
            console.error("Invalid message format:", result.error);
            ws.send(JSON.stringify({
              type: "error",
              error: "Invalid message format"
            }));
            return;
          }

          this.handleMessage(ws, result.data);
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          ws.send(JSON.stringify({
            type: "error",
            error: "Failed to process message"
          }));
        }
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });

      ws.on("close", () => {
        console.log("WebSocket connection closed");
      });
    });
  }

  private handleMessage(ws: WebSocket, message: z.infer<typeof messageSchema>) {
    switch (message.type) {
      case "subscribe":
        this.handleSubscribe(ws, message);
        break;
      case "ping":
        this.handlePing(ws);
        break;
      case "sheet_update":
        this.handleSheetUpdate(ws, message);
        break;
      default:
        ws.send(JSON.stringify({
          type: "error",
          error: "Unsupported message type"
        }));
    }
  }

  private handlePing(ws: WebSocket) {
    try {
      // Respond with pong to keep connection alive
      ws.send(JSON.stringify({
        type: "pong",
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error("Error handling ping:", error);
    }
  }

  private handleSubscribe(ws: WebSocket, message: z.infer<typeof subscribeMessageSchema>) {
    try {
      // Store the sheet ID in the WebSocket object for later reference
      (ws as any).subscribedSheets = (ws as any).subscribedSheets || [];
      (ws as any).subscribedSheets.push(message.sheetId);
      
      subscribeToSheet(message.sheetId, ws);
      ws.send(JSON.stringify({
        type: "subscribed",
        sheetId: message.sheetId
      }));
      
      console.log(`Client subscribed to sheet: ${message.sheetId}`);
    } catch (error) {
      console.error("Error subscribing to sheet:", error);
      ws.send(JSON.stringify({
        type: "error",
        error: "Failed to subscribe to sheet"
      }));
    }
  }
  
  private handleSheetUpdate(ws: WebSocket, message: z.infer<typeof sheetUpdateMessageSchema>) {
    try {
      const timestamp = new Date().toISOString();
      
      // Create enhanced update event
      const updateEvent: SheetUpdateEvent = {
        type: "sheet_update",
        sheetId: message.sheetId,
        operation: message.operation,
        target: message.target || "sheet",
        targetId: message.targetId,
        timestamp,
        change: message.change || {
          type: message.target || "sheet",
          action: message.operation === "insert" ? "created" :
                 message.operation === "delete" ? "deleted" : "updated",
          id: message.targetId || message.sheetId,
          timestamp
        }
      };
      
      // Broadcast the update to all clients subscribed to this sheet
      this.broadcastToSheet(message.sheetId, updateEvent);
      
      console.log(`Broadcast ${updateEvent.target} ${updateEvent.change?.action} event for sheet ${message.sheetId}`);
    } catch (error) {
      console.error("Error handling sheet update:", error);
      ws.send(JSON.stringify({
        type: "error",
        error: "Failed to process sheet update"
      }));
    }
  }
  
  /**
   * Broadcast a message to all clients subscribed to a specific sheet
   */
  broadcastToSheet(sheetId: string, message: any): void {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && (client as any).subscribedSheets?.includes(sheetId)) {
        client.send(JSON.stringify(message));
      }
    });
  }
  
  /**
   * Broadcast a row update to all clients subscribed to a sheet
   */
  broadcastRowUpdate(sheetId: string, rowId: string, action: UpdateAction, data?: any): void {
    const timestamp = new Date().toISOString();
    
    this.broadcastToSheet(sheetId, {
      type: "sheet_update",
      sheetId,
      operation: action === "created" ? "insert" :
                action === "deleted" ? "delete" : "update",
      target: "row",
      targetId: rowId,
      timestamp,
      change: {
        type: "row",
        action,
        id: rowId,
        data,
        timestamp
      }
    });
  }
  
  /**
   * Broadcast a cell update to all clients subscribed to a sheet
   */
  broadcastCellUpdate(sheetId: string, rowId: string, columnId: string, value: any): void {
    const timestamp = new Date().toISOString();
    const targetId = `${rowId}_${columnId}`;
    
    this.broadcastToSheet(sheetId, {
      type: "sheet_update",
      sheetId,
      operation: "update",
      target: "cell",
      targetId,
      timestamp,
      change: {
        type: "cell",
        action: "updated",
        id: targetId,
        data: { rowId, columnId, value },
        timestamp
      }
    });
  }

  /**
   * Get the number of connected clients
   */
  getConnectionCount(): number {
    return this.wss.clients.size;
  }

  /**
   * Close all connections and shut down the server
   */
  /**
   * Get the WebSocketService instance
   */
  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      throw new Error("WebSocketService not initialized. Call initialize() first.");
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize the WebSocketService
   */
  static initialize(server: Server): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(server);
    }
    return WebSocketService.instance;
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: string): void {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log("WebSocket server closed");
        WebSocketService.instance = null;
        resolve();
      });
    });
  }
}
