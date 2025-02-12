import { Router } from "express";
import crypto from "crypto";
import { sheetCache } from "../services/cache.js";
import { WebSocket } from "ws";
import { z } from "zod";

const router = Router();

// Webhook verification schema
const webhookChallengeSchema = z.object({
  challenge: z.string(),
  webhookId: z.string()
});

// Webhook event schema
const webhookEventSchema = z.object({
  webhookId: z.string(),
  scope: z.string(),
  scopeObjectId: z.string(), // sheet ID
  events: z.array(z.object({
    objectType: z.enum(["sheet", "row"]),
    action: z.enum(["created", "updated", "deleted"]),
    id: z.string(),
    timestamp: z.string()
  }))
});

// Store WebSocket clients for broadcasting updates
const clients = new Map<string, Set<WebSocket>>();

/**
 * Subscribe a WebSocket client to sheet updates
 */
export function subscribeToSheet(sheetId: string, ws: WebSocket) {
  if (!clients.has(sheetId)) {
    clients.set(sheetId, new Set());
  }
  clients.get(sheetId)?.add(ws);

  // Clean up on client disconnect
  ws.on("close", () => {
    const sheetClients = clients.get(sheetId);
    if (sheetClients) {
      sheetClients.delete(ws);
      if (sheetClients.size === 0) {
        clients.delete(sheetId);
      }
    }
  });
}

/**
 * Broadcast an update to all clients subscribed to a sheet
 */
function broadcastUpdate(sheetId: string, event: any) {
  const sheetClients = clients.get(sheetId);
  if (sheetClients) {
    sheetClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(event));
      }
    });
  }
}

/**
 * Verify webhook request signature
 */
function verifyWebhookSignature(req: any): boolean {
  const signature = req.headers["smartsheet-hmac-sha256"];
  if (!signature) return false;

  const secret = process.env.SMARTSHEET_WEBHOOK_SECRET;
  if (!secret) {
    console.error("SMARTSHEET_WEBHOOK_SECRET not configured");
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(req.rawBody); // Express raw body middleware required
  const computedSignature = hmac.digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

// Handle webhook verification requests
router.post("/smartsheet/webhook", async (req, res) => {
  try {
    // Verify request signature
    if (!verifyWebhookSignature(req)) {
      console.error("Invalid webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Check if this is a challenge request
    const challengeResult = webhookChallengeSchema.safeParse(req.body);
    if (challengeResult.success) {
      // Respond to webhook verification challenge
      return res.json({
        smartsheetHookResponse: challengeResult.data.challenge
      });
    }

    // Parse webhook event
    const eventResult = webhookEventSchema.safeParse(req.body);
    if (!eventResult.success) {
      console.error("Invalid webhook event format:", eventResult.error);
      return res.status(400).json({ error: "Invalid event format" });
    }

    const event = eventResult.data;
    const sheetId = event.scopeObjectId;

    // Process each event
    for (const change of event.events) {
      console.log(`Processing ${change.action} event for ${change.objectType} ${change.id}`);

      // Invalidate cache for the affected sheet
      sheetCache.invalidate(sheetId);

      // Broadcast update to connected clients
      broadcastUpdate(sheetId, {
        type: "sheet_update",
        sheetId,
        change: {
          type: change.objectType,
          action: change.action,
          id: change.id,
          timestamp: change.timestamp
        }
      });
    }

    res.json({ status: "success" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
