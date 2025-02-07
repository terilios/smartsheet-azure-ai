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

  const smartsheetClient = smartsheet.createClient({
    accessToken: process.env.SMARTSHEET_ACCESS_TOKEN,
    logLevel: 'info'
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
      // Extract potential Smartsheet commands from the message
      const content = result.data.content.toLowerCase();
      let assistantResponse = "";

      try {
        // Handle Smartsheet operations based on user message
        if (content.includes("add column")) {
          const config = await storage.getSmartsheetConfig();
          if (!config) {
            throw new Error("Smartsheet not configured");
          }

          // Extract column name from message (simplified example)
          const columnName = content.split("add column")[1].trim();
          await smartsheetClient.sheets.addColumn({
            sheetId: config.sheetId,
            body: {
              title: columnName,
              type: 'TEXT_NUMBER',
              index: 0
            }
          });
          assistantResponse = `### Success! 🎉\n\nI've added a new column:\n- Name: \`${columnName}\`\n- Type: Text/Number\n- Position: Beginning of sheet\n\nYou can now see this column in your Smartsheet view.`;
        } else if (content.includes("analyze row")) {
          const config = await storage.getSmartsheetConfig();
          if (!config) {
            throw new Error("Smartsheet not configured");
          }

          // Default to OpenAI for analysis
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ 
              role: "user", 
              content: `${result.data.content}\n\nProvide your analysis in a clear, formatted way using markdown.` 
            }],
          });
          assistantResponse = response.choices[0].message?.content || "Error processing request";
        } else {
          // Default to OpenAI response for non-Smartsheet commands
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ 
              role: "user", 
              content: `${result.data.content}\n\nPlease format your response using markdown for better readability.` 
            }],
          });
          assistantResponse = response.choices[0].message?.content || "Error processing request";
        }
      } catch (error) {
        console.error('Error processing request:', error);
        assistantResponse = `### Error ❌\n\n\`\`\`\n${error instanceof Error ? error.message : 'An unknown error occurred'}\n\`\`\`\n\nPlease try again or rephrase your request.`;
      }

      const assistantMessage = await storage.createMessage({
        content: assistantResponse,
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