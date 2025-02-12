import { Router } from "express";
import { z } from "zod";
import { type Message, type MessageMetadata } from "../shared/schema";
import { SmartsheetTools, smartsheetTools } from "./tools/smartsheet";
import { storage } from "./storage";
import { openaiCircuitBreaker } from "./utils/retry";
import sessionsRouter from "./routes/sessions";
import llm, { ChatCompletionResponse, CircuitBreakerResult } from "./services/llm";
import { Result } from "./utils/types";

const router = Router();

// Mount session routes
router.use("/api/sessions", sessionsRouter);
const smartsheet = new SmartsheetTools();

// Error handling utility
function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    return JSON.stringify(error);
  }
  return 'An unknown error occurred';
}

// Get sheet data
router.get("/api/smartsheet/:sheetId", async (req, res) => {
  try {
    const { sheetId } = req.params;
    if (!sheetId) {
      return res.status(400).json({ 
        success: false, 
        error: "sheetId is required" 
      });
    }

    const result = await smartsheet.getSheetData({ sheetId });
    res.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    res.status(500).json({ 
      success: false, 
      error: serializeError(error)
    });
  }
});

// Get messages for a session
router.get("/api/messages", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ 
        success: false, 
        error: "sessionId is required" 
      });
    }

    const messages = await storage.getMessages(sessionId);
    res.json(messages);
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ 
      success: false, 
      error: serializeError(error)
    });
  }
});

// Delete messages for a session
router.delete("/api/messages", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ 
        success: false, 
        error: "sessionId is required" 
      });
    }

    await storage.clearMessages(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting messages:", error);
    res.status(500).json({ 
      success: false, 
      error: serializeError(error)
    });
  }
});

// Send a message and get a response
router.post("/api/messages", async (req, res) => {
  try {
    const { content, metadata } = req.body;
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: "content is required" 
      });
    }

    // Get session messages for context
    const messages = metadata?.sessionId ? 
      await storage.getMessages(metadata.sessionId) : 
      [];

    // Add system message if this is a new conversation
    if (messages.length === 0) {
      const systemMessage: Message = {
        role: "system",
        content: "You are a helpful assistant that can interact with Smartsheet data. You can view and modify sheets, and perform operations like summarization and analysis.",
        metadata: {
          sessionId: metadata?.sessionId,
          timestamp: new Date().toISOString(),
          operation: null,
          status: null
        }
      };
      messages.push(systemMessage);
      if (metadata?.sessionId) {
        await storage.addMessage(metadata.sessionId, systemMessage);
      }
    }

    // Add user message
    const userMessage: Message = {
      role: "user",
      content,
      metadata: {
        ...metadata,
        status: "success",
        timestamp: new Date().toISOString()
      }
    };
    messages.push(userMessage);
    if (metadata?.sessionId) {
      await storage.addMessage(metadata.sessionId, userMessage);
    }

    // Get completion from OpenAI
    const result = await openaiCircuitBreaker.execute(
      async () => llm.getChatCompletion({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          name: msg.name
        })),
        tools: smartsheetTools
      }),
      {
        maxAttempts: 3,
        retryableErrors: [
          /rate limit/i,
          /timeout/i,
          /busy/i,
          /5\d\d/,
          "The server is currently processing too many requests"
        ]
      }
    );

    if (!result.success || !result.result) {
      throw new Error(result.error?.message || "Failed to get completion from OpenAI");
    }

    const completion = result.result;
    if (!completion.success || !completion.result || !completion.result.choices || !completion.result.choices[0]) {
      throw new Error("No completion generated");
    }

    const choice = completion.result.choices[0];

    // Handle tool calls
    if (choice.message.tool_calls) {
      const toolCall = choice.message.tool_calls[0];
      
      // Add assistant's tool call message
      const assistantMessage: Message = {
        role: "assistant",
        content: choice.message.content || "",
        name: toolCall.function.name,
        metadata: {
          sessionId: metadata?.sessionId,
          timestamp: new Date().toISOString(),
          operation: toolCall.function.name,
          status: "pending"
        }
      };
      messages.push(assistantMessage);
      if (metadata?.sessionId) {
        await storage.addMessage(metadata.sessionId, assistantMessage);
      }

      // Execute tool call
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const toolResult = await (smartsheet as any)[toolCall.function.name](args);

        // Add function result message
        const functionMessage: Message = {
          role: "function",
          name: toolCall.function.name,
          content: JSON.stringify(toolResult),
          metadata: {
            sessionId: metadata?.sessionId,
            timestamp: new Date().toISOString(),
            operation: toolCall.function.name,
            status: "success"
          }
        };
        messages.push(functionMessage);
        if (metadata?.sessionId) {
          await storage.addMessage(metadata.sessionId, functionMessage);
        }

        // Get final response from OpenAI
        const finalResult = await openaiCircuitBreaker.execute(
          async () => llm.getChatCompletion({
            messages: messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              name: msg.name
            }))
          }),
          {
            maxAttempts: 3,
            retryableErrors: [
              /rate limit/i,
              /timeout/i,
              /busy/i,
              /5\d\d/,
              "The server is currently processing too many requests"
            ]
          }
        );

        if (!finalResult.success || !finalResult.result) {
          throw new Error(finalResult.error?.message || "Failed to get final completion from OpenAI");
        }

        const finalCompletion = finalResult.result;
        if (!finalCompletion.success || !finalCompletion.result || !finalCompletion.result.choices || !finalCompletion.result.choices[0]) {
          throw new Error("No final completion generated");
        }

        const finalChoice = finalCompletion.result.choices[0];

        // Add final assistant message
        const finalMessage: Message = {
          role: "assistant",
          content: finalChoice.message.content || "",
          metadata: {
            sessionId: metadata?.sessionId,
            timestamp: new Date().toISOString(),
            operation: toolCall.function.name,
            status: "success"
          }
        };
        messages.push(finalMessage);
        if (metadata?.sessionId) {
          await storage.addMessage(metadata.sessionId, finalMessage);
        }

        res.json(finalMessage);
      } catch (error) {
        console.error("Error executing tool:", error);
        const errorMessage: Message = {
          role: "assistant",
          content: serializeError(error),
          metadata: {
            sessionId: metadata?.sessionId,
            timestamp: new Date().toISOString(),
            operation: toolCall.function.name,
            status: "error",
            error: serializeError(error)
          }
        };
        messages.push(errorMessage);
        if (metadata?.sessionId) {
          await storage.addMessage(metadata.sessionId, errorMessage);
        }
        res.json(errorMessage);
      }
    } else {
      // No tool call, just a regular response
      const message: Message = {
        role: "assistant",
        content: choice.message.content || "",
        metadata: {
          sessionId: metadata?.sessionId,
          timestamp: new Date().toISOString(),
          operation: null,
          status: "success"
        }
      };
      messages.push(message);
      if (metadata?.sessionId) {
        await storage.addMessage(metadata.sessionId, message);
      }
      res.json(message);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    const errorMessage: Message = {
      role: "assistant",
      content: "I encountered an error while processing your request.",
      metadata: {
        timestamp: new Date().toISOString(),
        operation: null,
        status: "error",
        error: serializeError(error)
      }
    };
    if (error instanceof Error) {
      console.error(error.stack);
    }
    res.status(500).json(errorMessage);
  }
});

export default router;
