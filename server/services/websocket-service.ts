import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { z } from "zod";
import { serverEventBus, ServerEventType } from "./events.js";

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

/**
 * WebSocketClient interface for tracking client subscriptions
 */
interface WebSocketClient extends WebSocket {
  id: string;
  subscribedSheets: Set<string>;
  lastActivity: number;
}

/**
 * Enhanced WebSocketService that uses the centralized event system
 */
export class WebSocketService {
  private static instance: WebSocketService | null = null;
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private sheetSubscriptions: Map<string, Set<string>> = new Map(); // sheetId -> Set of clientIds

  private constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.setupWebSocketServer();
    this.setupEventListeners();
    this.startHeartbeatCheck();
  }

  /**
   * Set up the WebSocket server and connection handling
   */
  private setupWebSocketServer() {
    this.wss.on("connection", (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client = this.setupClient(ws, clientId);
      
      console.log(`New WebSocket connection established (clientId: ${clientId})`);
      serverEventBus.publish(ServerEventType.WS_CLIENT_CONNECTED, { clientId });

      client.on("message", (data: string) => {
        try {
          const message = JSON.parse(data);
          const result = messageSchema.safeParse(message);

          if (!result.success) {
            console.error("Invalid message format:", result.error);
            client.send(JSON.stringify({
              type: "error",
              error: "Invalid message format"
            }));
            return;
          }

          this.handleMessage(client, result.data);
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          client.send(JSON.stringify({
            type: "error",
            error: "Failed to process message"
          }));
        }
      });

      client.on("error", (error) => {
        console.error(`WebSocket error (clientId: ${clientId}):`, error);
        serverEventBus.publish(ServerEventType.SYSTEM_ERROR, {
          message: "WebSocket client error",
          clientId,
          error: error.message
        });
      });

      client.on("close", () => {
        console.log(`WebSocket connection closed (clientId: ${clientId})`);
        this.handleClientDisconnect(clientId);
      });
    });
  }

  /**
   * Set up event listeners for the centralized event system
   */
  private setupEventListeners() {
    // Listen for sheet data updates
    serverEventBus.subscribe(ServerEventType.SHEET_DATA_UPDATED, (event) => {
      const { sheetId } = event.data;
      if (sheetId) {
        this.broadcastToSheet(sheetId, {
          type: "sheet_update",
          sheetId,
          operation: "update",
          target: "sheet",
          timestamp: new Date().toISOString(),
          change: {
            type: "sheet",
            action: "updated",
            id: sheetId,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    // Listen for cell updates
    serverEventBus.subscribe(ServerEventType.SHEET_CELL_UPDATED, (event) => {
      const { sheetId, rowId, columnId, value } = event.data;
      if (sheetId && rowId && columnId) {
        this.broadcastCellUpdate(sheetId, rowId, columnId, value);
      }
    });

    // Listen for row updates
    serverEventBus.subscribe(ServerEventType.SHEET_ROW_UPDATED, (event) => {
      const { sheetId, rowId, data } = event.data;
      if (sheetId && rowId) {
        this.broadcastRowUpdate(sheetId, rowId, "updated", data);
      }
    });

    // Listen for row additions
    serverEventBus.subscribe(ServerEventType.SHEET_ROW_ADDED, (event) => {
      const { sheetId, rowId, data } = event.data;
      if (sheetId && rowId) {
        this.broadcastRowUpdate(sheetId, rowId, "created", data);
      }
    });

    // Listen for row deletions
    serverEventBus.subscribe(ServerEventType.SHEET_ROW_DELETED, (event) => {
      const { sheetId, rowId } = event.data;
      if (sheetId && rowId) {
        this.broadcastRowUpdate(sheetId, rowId, "deleted");
      }
    });
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Set up a new WebSocket client
   */
  private setupClient(ws: WebSocket, clientId: string): WebSocketClient {
    const client = ws as WebSocketClient;
    client.id = clientId;
    client.subscribedSheets = new Set();
    client.lastActivity = Date.now();
    
    this.clients.set(clientId, client);
    return client;
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Clean up sheet subscriptions
    client.subscribedSheets.forEach(sheetId => {
      const subscribers = this.sheetSubscriptions.get(sheetId);
      if (subscribers) {
        subscribers.delete(clientId);
        if (subscribers.size === 0) {
          this.sheetSubscriptions.delete(sheetId);
        }
      }
    });
    
    // Remove client
    this.clients.delete(clientId);
    
    // Publish event
    serverEventBus.publish(ServerEventType.WS_CLIENT_DISCONNECTED, { clientId });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(client: WebSocketClient, message: z.infer<typeof messageSchema>) {
    // Update last activity timestamp
    client.lastActivity = Date.now();
    
    switch (message.type) {
      case "subscribe":
        this.handleSubscribe(client, message);
        break;
      case "ping":
        this.handlePing(client);
        break;
      case "sheet_update":
        this.handleSheetUpdate(client, message);
        break;
      default:
        client.send(JSON.stringify({
          type: "error",
          error: "Unsupported message type"
        }));
    }
  }

  /**
   * Handle ping messages
   */
  private handlePing(client: WebSocketClient) {
    try {
      // Respond with pong to keep connection alive
      client.send(JSON.stringify({
        type: "pong",
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error handling ping for client ${client.id}:`, error);
    }
  }

  /**
   * Handle subscribe messages
   */
  private handleSubscribe(client: WebSocketClient, message: z.infer<typeof subscribeMessageSchema>) {
    try {
      const { sheetId } = message;
      
      // Add to client's subscribed sheets
      client.subscribedSheets.add(sheetId);
      
      // Add to sheet subscriptions
      if (!this.sheetSubscriptions.has(sheetId)) {
        this.sheetSubscriptions.set(sheetId, new Set());
      }
      this.sheetSubscriptions.get(sheetId)!.add(client.id);
      
      // Send confirmation
      client.send(JSON.stringify({
        type: "subscribed",
        sheetId
      }));
      
      // Publish event
      serverEventBus.publish(ServerEventType.WS_CLIENT_SUBSCRIBED, {
        clientId: client.id,
        sheetId
      });
      
      console.log(`Client ${client.id} subscribed to sheet: ${sheetId}`);
    } catch (error) {
      console.error(`Error subscribing client ${client.id} to sheet:`, error);
      client.send(JSON.stringify({
        type: "error",
        error: "Failed to subscribe to sheet"
      }));
    }
  }

  /**
   * Handle sheet update messages
   */
  private handleSheetUpdate(client: WebSocketClient, message: z.infer<typeof sheetUpdateMessageSchema>) {
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
      
      // Publish appropriate event based on the update type
      this.publishUpdateEvent(updateEvent);
      
      console.log(`Broadcast ${updateEvent.target} ${updateEvent.change?.action} event for sheet ${message.sheetId}`);
    } catch (error) {
      console.error(`Error handling sheet update from client ${client.id}:`, error);
      client.send(JSON.stringify({
        type: "error",
        error: "Failed to process sheet update"
      }));
    }
  }

  /**
   * Publish appropriate event based on the update type
   */
  private publishUpdateEvent(updateEvent: SheetUpdateEvent) {
    const { sheetId, change } = updateEvent;
    if (!change) return;
    
    const { type, action, id, data } = change;
    
    switch (type) {
      case "sheet":
        serverEventBus.publish(ServerEventType.SHEET_DATA_UPDATED, {
          sheetId,
          action
        });
        break;
      case "row":
        if (action === "created") {
          serverEventBus.publish(ServerEventType.SHEET_ROW_ADDED, {
            sheetId,
            rowId: id,
            data
          });
        } else if (action === "updated") {
          serverEventBus.publish(ServerEventType.SHEET_ROW_UPDATED, {
            sheetId,
            rowId: id,
            data
          });
        } else if (action === "deleted") {
          serverEventBus.publish(ServerEventType.SHEET_ROW_DELETED, {
            sheetId,
            rowId: id
          });
        }
        break;
      case "cell":
        if (data && data.rowId && data.columnId) {
          serverEventBus.publish(ServerEventType.SHEET_CELL_UPDATED, {
            sheetId,
            rowId: data.rowId,
            columnId: data.columnId,
            value: data.value
          });
        }
        break;
    }
  }

  /**
   * Start periodic heartbeat check to detect stale connections
   */
  private startHeartbeatCheck() {
    const HEARTBEAT_INTERVAL = 30000; // 30 seconds
    const MAX_IDLE_TIME = 120000; // 2 minutes
    
    setInterval(() => {
      const now = Date.now();
      
      this.clients.forEach((client, clientId) => {
        // Check if client has been idle for too long
        if (now - client.lastActivity > MAX_IDLE_TIME) {
          console.log(`Closing idle connection for client ${clientId}`);
          client.terminate();
          this.handleClientDisconnect(clientId);
          return;
        }
        
        // Send ping to active clients
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify({
              type: "ping",
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            console.error(`Error sending ping to client ${clientId}:`, error);
          }
        }
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Broadcast a message to all clients subscribed to a specific sheet
   */
  broadcastToSheet(sheetId: string, message: any): void {
    const subscribers = this.sheetSubscriptions.get(sheetId);
    if (!subscribers || subscribers.size === 0) return;
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    subscribers.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sentCount++;
        } catch (error) {
          console.error(`Error sending message to client ${clientId}:`, error);
        }
      }
    });
    
    if (sentCount > 0) {
      console.log(`Broadcast message to ${sentCount} clients subscribed to sheet ${sheetId}`);
    }
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
    return this.clients.size;
  }

  /**
   * Get the number of clients subscribed to a sheet
   */
  getSheetSubscriberCount(sheetId: string): number {
    const subscribers = this.sheetSubscriptions.get(sheetId);
    return subscribers ? subscribers.size : 0;
  }

  /**
   * Close all connections and shut down the server
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      this.clients.forEach(client => {
        try {
          client.close();
        } catch (error) {
          console.error(`Error closing client ${client.id}:`, error);
        }
      });
      
      // Clear maps
      this.clients.clear();
      this.sheetSubscriptions.clear();
      
      // Close the WebSocket server
      this.wss.close(() => {
        console.log("WebSocket server closed");
        WebSocketService.instance = null;
        resolve();
      });
    });
  }

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
  broadcast(message: string | object): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
        } catch (error) {
          console.error(`Error broadcasting to client ${client.id}:`, error);
        }
      }
    });
  }
}