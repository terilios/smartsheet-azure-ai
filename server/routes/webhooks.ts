import { Router } from "express";
import crypto from "crypto";
import { sheetCache } from "../services/cache.js";
import { z } from "zod";
import { serverEventBus, ServerEventType } from "../services/events.js";

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
      serverEventBus.publish(ServerEventType.SYSTEM_WARNING, {
        message: "Invalid webhook signature received",
        source: "webhooks"
      });
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Check if this is a challenge request
    const challengeResult = webhookChallengeSchema.safeParse(req.body);
    if (challengeResult.success) {
      // Respond to webhook verification challenge
      serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
        message: "Webhook verification challenge received",
        webhookId: challengeResult.data.webhookId,
        source: "webhooks"
      });
      return res.json({
        smartsheetHookResponse: challengeResult.data.challenge
      });
    }

    // Parse webhook event
    const eventResult = webhookEventSchema.safeParse(req.body);
    if (!eventResult.success) {
      console.error("Invalid webhook event format:", eventResult.error);
      serverEventBus.publish(ServerEventType.SYSTEM_ERROR, {
        message: "Invalid webhook event format",
        error: eventResult.error.message,
        source: "webhooks"
      });
      return res.status(400).json({ error: "Invalid event format" });
    }

    const event = eventResult.data;
    const sheetId = event.scopeObjectId;

    // Process each event
    for (const change of event.events) {
      console.log(`Processing ${change.action} event for ${change.objectType} ${change.id}`);

      // Invalidate cache for the affected sheet
      sheetCache.invalidate(sheetId);
      
      // Publish cache invalidation event
      serverEventBus.publish(ServerEventType.CACHE_INVALIDATED, {
        sheetId,
        reason: `${change.objectType} ${change.action}`,
        source: "webhooks"
      });

      // Publish appropriate event based on the change type
      if (change.objectType === "sheet") {
        serverEventBus.publish(ServerEventType.SHEET_DATA_UPDATED, {
          sheetId,
          action: change.action,
          id: change.id,
          timestamp: change.timestamp,
          source: "webhooks"
        });
      } else if (change.objectType === "row") {
        switch (change.action) {
          case "created":
            serverEventBus.publish(ServerEventType.SHEET_ROW_ADDED, {
              sheetId,
              rowId: change.id,
              timestamp: change.timestamp,
              source: "webhooks"
            });
            break;
          case "updated":
            serverEventBus.publish(ServerEventType.SHEET_ROW_UPDATED, {
              sheetId,
              rowId: change.id,
              timestamp: change.timestamp,
              source: "webhooks"
            });
            break;
          case "deleted":
            serverEventBus.publish(ServerEventType.SHEET_ROW_DELETED, {
              sheetId,
              rowId: change.id,
              timestamp: change.timestamp,
              source: "webhooks"
            });
            break;
        }
      }
    }

    res.json({ status: "success" });
  } catch (error) {
    console.error("Error processing webhook:", error);
    serverEventBus.publish(ServerEventType.SYSTEM_ERROR, {
      message: "Error processing webhook",
      error: error instanceof Error ? error.message : "Unknown error",
      source: "webhooks"
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
