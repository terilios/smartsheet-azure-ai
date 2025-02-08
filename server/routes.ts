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

  // Add proxy endpoint for iframe content
  app.get("/api/proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        res.status(400).send("Missing URL parameter");
        return;
      }

      // Validate URL
      try {
        new URL(targetUrl);
      } catch {
        res.status(400).send("Invalid URL");
        return;
      }

      // Fetch the target URL
      const response = await fetch(targetUrl);
      const contentType = response.headers.get("content-type");

      // Remove security headers
      res.removeHeader("x-frame-options");
      res.removeHeader("content-security-policy");

      // Copy other relevant headers
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      // If HTML content, rewrite URLs to go through proxy
      if (contentType?.includes("text/html")) {
        let content = await response.text();

        // Rewrite relative URLs to absolute
        const baseUrl = new URL(targetUrl);
        content = content.replace(
          /(src|href|action)=["']\/([^"']*?)["']/g,
          `$1="${baseUrl.origin}/$2"`
        );

        // Rewrite absolute URLs to go through proxy
        content = content.replace(
          /(src|href|action)=["'](https?:\/\/[^"']*?)["']/g,
          `$1="/api/proxy?url=$2"`
        );

        // Send modified content
        res.send(content);
      } else {
        // For non-HTML content, stream the response directly
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Failed to load content");
    }
  });

  // Existing routes...
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
          model: "gpt-4",
          messages: [
            { 
              role: "system", 
              content: "You are an AI assistant that helps users work with Smartsheet. Here are your capabilities:\n\n" +
                "1. You can view and analyze sheet data using getSheetData\n" +
                "2. You can open sheets using openSheet\n" +
                "3. You can add columns using addColumn\n\n" +
                "Guidelines:\n" +
                "- Always use getSheetData to understand the sheet structure before answering questions\n" +
                "- When users ask about specific columns or data, fetch the latest data first\n" +
                "- Format responses using markdown for better readability\n" +
                "- Keep track of the current context and sheet being worked on\n" +
                "- Provide specific, data-driven responses based on the actual sheet content" +
                (lastSheetId ? `\n\nCurrent active sheet ID: ${lastSheetId}` : "")
            },

            // Include more context from previous messages
            ...previousMessages.slice(-10), // Include last 10 messages for better context
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
              const { columns, rows, sheetName, totalRows } = result.data;

              // Create a more detailed analysis of the sheet data
              const columnAnalysis = columns.map(col => {
                const values = rows.map(row => row[col.title]).filter(v => v !== null && v !== undefined);
                return {
                  name: col.title,
                  type: col.type,
                  nonEmptyCount: values.length,
                  sample: values.slice(0, 3)
                };
              });

              assistantResponse = `### Sheet Information: "${sheetName}"

**Overview:**
- Total Rows: ${totalRows}
- Number of Columns: ${columns.length}

**Column Analysis:**
${columnAnalysis.map(col => 
`- ${col.title} (${col.type})
  - Contains ${col.nonEmptyCount} non-empty values
  - Sample values: ${col.sample.slice(0, 3).join(', ')}`
).join('\n')}

**Sample Data (First 3 Rows):**
${rows.slice(0, 3).map(row => {
  const items = columns.map(col => `${col.title}: ${row[col.title] || 'N/A'}`);
  return `- Row ${row.id}:\n  ${items.join('\n  ')}`;
}).join('\n')}

${rows.length > 3 ? '\n_Showing first 3 rows..._' : ''}`;

              metadata = { 
                sheetData: result.data,
                sheetAnalysis: columnAnalysis
              };
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