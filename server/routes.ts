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
  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const smartsheetClient = new SmartsheetTools(process.env.SMARTSHEET_ACCESS_TOKEN || '');

  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.delete("/api/messages", async (_req, res) => {
    await storage.deleteAllMessages();
    res.json([]);
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
        // Get previous messages to maintain context
        const messages = await storage.getMessages();
        const previousMessages = messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          metadata: msg.metadata
        }));

        // Get the most recent sheet ID from context
        const lastSheetId = messages
          .reverse()
          .find(msg => msg.metadata?.sheetId)
          ?.metadata?.sheetId;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { 
              role: "system", 
              content: `You are an AI assistant that helps users work with Smartsheet data. Here are your operational guidelines:

1. Query Processing:
   - For general questions not related to Smartsheet data, respond directly without using tools
   - For Smartsheet-related queries, use the appropriate tool to fetch data first, then process it internally
   - Never show raw API responses or data dumps to users

2. Tool Usage:
   - getSheetData: Use this internally to fetch data before answering questions about specific cells or content
   - openSheet: Use only when explicitly asked to open a new sheet
   - addColumn: Use only when explicitly asked to add new columns

3. Response Formatting:
   - Keep responses concise and focused on answering the user's specific question
   - Use natural language in responses
   - Format responses using markdown for better readability
   - When referencing sheet data, integrate it naturally into your response

4. Context Awareness:
   - Keep track of the current sheet being worked on
   - Maintain conversation context
   - If a query requires sheet data but no sheet is open, ask the user to open a sheet first

Current active sheet ID: ${lastSheetId || "No sheet currently open"}`
            },
            ...previousMessages.slice(-10),
            { 
              role: "user", 
              content: result.data.content 
            }
          ],
          tools: smartsheetTools,
        });

        const aiResponse = completion.choices[0].message;
        let assistantResponse = "";
        let metadata = null;

        if (aiResponse.tool_calls?.length) {
          const toolCall = aiResponse.tool_calls[0];
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // If no sheet ID is provided but we have one from context, use that
          if (functionName === "getSheetData" && !functionArgs.sheetId && lastSheetId) {
            functionArgs.sheetId = lastSheetId;
          }

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
            case "getSheetData": {
              const result = await smartsheetClient.getSheetData(functionArgs);

              // Follow up with another completion to analyze the data
              const followUpCompletion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { 
                    role: "system", 
                    content: "You are helping to analyze Smartsheet data. Use the provided data to answer the user's question naturally, without showing raw data dumps. Focus only on the specific information requested."
                  },
                  ...previousMessages.slice(-3),
                  { 
                    role: "user", 
                    content: result.data.content || previousMessages[previousMessages.length - 1].content
                  },
                  {
                    role: "system",
                    content: `Here is the relevant sheet data in JSON format to help answer the question:\n${JSON.stringify(result.data, null, 2)}`
                  }
                ]
              });

              assistantResponse = followUpCompletion.choices[0].message.content || "I couldn't find the specific information you're looking for in the sheet.";
              metadata = { sheetData: result.data };
              break;
            }
            default:
              throw new Error(`Unknown tool: ${functionName}`);
          }
        } else {
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
          content: `I encountered an error while processing your request. Please try again or rephrase your question. Error details: ${error instanceof Error ? error.message : 'Unknown error'}`,
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