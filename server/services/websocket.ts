import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { z } from "zod";
import { subscribeToSheet } from "../routes/webhooks.js";

// Message schemas
const subscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  sheetId: z.string()
});

const messageSchema = z.discriminatedUnion("type", [
  subscribeMessageSchema
]);

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
      default:
        ws.send(JSON.stringify({
          type: "error",
          error: "Unsupported message type"
        }));
    }
  }

  private handleSubscribe(ws: WebSocket, message: z.infer<typeof subscribeMessageSchema>) {
    try {
      subscribeToSheet(message.sheetId, ws);
      ws.send(JSON.stringify({
        type: "subscribed",
        sheetId: message.sheetId
      }));
    } catch (error) {
      console.error("Error subscribing to sheet:", error);
      ws.send(JSON.stringify({
        type: "error",
        error: "Failed to subscribe to sheet"
      }));
    }
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
