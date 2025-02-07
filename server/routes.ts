import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema, insertSmartsheetConfigSchema } from "@shared/schema";
import OpenAI from "openai";
import smartsheet from "smartsheet";

export function registerRoutes(app: Express): Server {
  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post("/api/messages", async (req, res) => {
    const result = insertMessageSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    const message = await storage.createMessage(result.data);

    if (result.data.role === "user") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: result.data.content }],
      });

      const assistantMessage = await storage.createMessage({
        content: response.choices[0].message?.content || "Error processing request",
        role: "assistant",
        metadata: null
      });

      res.json([message, assistantMessage]);
    } else {
      res.json([message]);
    }
  });

  app.get("/api/smartsheet/config", async (_req, res) => {
    const config = await storage.getSmartsheetConfig();
    res.json(config);
  });

  app.post("/api/smartsheet/config", async (req, res) => {
    const result = insertSmartsheetConfigSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    const config = await storage.setSmartsheetConfig(result.data);
    res.json(config);
  });

  const httpServer = createServer(app);
  return httpServer;
}