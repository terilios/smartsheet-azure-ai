import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import OpenAI from "openai";
import smartsheet from "smartsheet";

if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
  throw new Error("SMARTSHEET_ACCESS_TOKEN environment variable must be set");
}

export function registerRoutes(app: Express): Server {
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
      let metadata = null;

      try {
        // Handle Smartsheet operations based on user message
        if (content.includes("open sheet") || content.includes("view sheet")) {
          // Extract sheet ID from the message
          const match = content.match(/sheet (\d+)/);
          if (!match) {
            throw new Error("Please provide a sheet ID (e.g., 'open sheet 1234567890')");
          }

          const sheetId = match[1];

          try {
            // Verify the sheet exists and is accessible
            await smartsheetClient.sheets.getSheet({ id: sheetId });
            metadata = { sheetId };
            assistantResponse = `### Success! 🎉\n\nI've loaded the Smartsheet with ID: \`${sheetId}\`\n\nYou should see it in the right panel now.`;
          } catch (err: any) {
            if (err.statusCode === 401) {
              throw new Error("The Smartsheet access token appears to be invalid. Please contact your administrator.");
            } else if (err.statusCode === 404) {
              throw new Error(`Sheet with ID ${sheetId} was not found. Please verify the sheet ID and try again.`);
            } else {
              throw err;
            }
          }
        } else if (content.includes("add column")) {
          // Extract column name and current sheet ID
          const columnName = content.split("add column")[1]?.trim();
          if (!columnName) {
            throw new Error("Please specify a column name (e.g., 'add column Status')");
          }

          const lastSheetId = (await storage.getMessages())
            .filter(m => m.role === "assistant" && m.metadata?.sheetId)
            .pop()?.metadata?.sheetId;

          if (!lastSheetId) {
            throw new Error("Please open a sheet first before adding columns");
          }

          try {
            await smartsheetClient.sheets.addColumn({
              sheetId: lastSheetId,
              body: {
                title: columnName,
                type: 'TEXT_NUMBER',
                index: 0
              }
            });
            metadata = { sheetId: lastSheetId };
            assistantResponse = `### Success! 🎉\n\nI've added a new column:\n- Name: \`${columnName}\`\n- Type: Text/Number\n- Position: Beginning of sheet\n\nYou can now see this column in your Smartsheet view.`;
          } catch (err: any) {
            if (err.statusCode === 401) {
              throw new Error("The Smartsheet access token appears to be invalid. Please contact your administrator.");
            } else if (err.statusCode === 404) {
              throw new Error(`Sheet with ID ${lastSheetId} was not found. Please try opening the sheet again.`);
            } else {
              throw err;
            }
          }
        } else {
          // Default to OpenAI response for non-Smartsheet commands
          const response = await openai.chat.completions.create({
            model: "gpt-4",
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
        metadata
      });

      res.json([message, assistantMessage]);
    } else {
      res.json([message]);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}