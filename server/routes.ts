import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import OpenAI from "openai";
import { SmartsheetTools, smartsheetTools } from "./tools/smartsheet";

if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
  throw new Error("SMARTSHEET_ACCESS_TOKEN environment variable must be set");
}

export function registerRoutes(app: Express): Server {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const smartsheetClient = new SmartsheetTools(process.env.SMARTSHEET_ACCESS_TOKEN);

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
      try {
        // First, get LLM's interpretation of the request
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ 
            role: "system", 
            content: "You are an AI assistant that helps users work with Smartsheet. When users want to perform Smartsheet operations, use the provided tools. Otherwise, provide helpful responses about Smartsheet usage."
          },
          { 
            role: "user", 
            content: result.data.content 
          }],
          tools: smartsheetTools,
        });

        const aiResponse = completion.choices[0].message;
        let assistantResponse = "";
        let metadata = null;

        // Check if the LLM wants to use a tool
        if (aiResponse.tool_calls?.length) {
          const toolCall = aiResponse.tool_calls[0];
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // Execute the appropriate tool
          switch (functionName) {
            case "openSheet": {
              const result = await smartsheetClient.openSheet(functionArgs);
              assistantResponse = result.message;
              metadata = result.metadata;
              break;
            }
            case "addColumn": {
              const result = await smartsheetClient.addColumn(functionArgs);
              assistantResponse = result.message;
              metadata = result.metadata;
              break;
            }
            default:
              throw new Error(`Unknown tool: ${functionName}`);
          }
        } else {
          // If no tool was called, use the LLM's response directly
          assistantResponse = aiResponse.content || "I couldn't process that request.";
        }

        const assistantMessage = await storage.createMessage({
          content: assistantResponse,
          role: "assistant",
          metadata
        });

        res.json([message, assistantMessage]);
      } catch (error) {
        console.error('Error processing request:', error);
        const errorMessage = await storage.createMessage({
          content: `### Error ❌\n\n\`\`\`\n${error instanceof Error ? error.message : 'An unknown error occurred'}\n\`\`\`\n\nPlease try again or rephrase your request.`,
          role: "assistant",
          metadata: null
        });
        res.json([message, errorMessage]);
      }
    } else {
      res.json([message]);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}