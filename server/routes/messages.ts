import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { 
  getChatCompletion, 
  type ChatMessage, 
  type ChatCompletionTool, 
  enhanceSystemPrompt, 
  loadSheetData, 
  pruneConversationMessages 
} from "../services/llm.js";
import { type Message } from "@shared/schema";
import {
  getSheetInfo,
  verifySheetAccess,
  type FilterCriteria
} from "../tools/smartsheet.js";
import crypto from "crypto";
import { toolExecutor } from "../utils/tool-executor.js";

const router = Router();

// GET /api/messages - Get messages for a session
router.get("/", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "sessionId is required"
    });
  }

  try {
    const messages = await storage.getMessages(sessionId);
    res.json(messages);
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// POST /api/messages - Send a new message and get AI response
router.post("/", async (req, res) => {
  const { content, metadata } = req.body;
  
  if (!content || content.trim() === "") {
    return res.status(400).json({
      success: false,
      error: "content is required"
    });
  }

  if (!metadata || !metadata.sessionId) {
    return res.status(400).json({
      success: false,
      error: "metadata.sessionId is required"
    });
  }

  const sessionId = metadata.sessionId;
  const sheetId = metadata.sheetId;

  try {
    // Get session to verify it exists
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found"
      });
    }

    // Add user message to storage
    const userMessage: Message = {
      role: "user",
      content,
      metadata: {
        ...metadata,
        id: crypto.randomUUID(),
        type: "USER",
        timestamp: new Date().toISOString()
      }
    };
    
    await storage.addMessage(sessionId, userMessage);

    // Get all messages for context
    const allMessages = await storage.getMessages(sessionId);
    
    // Check if we need to fetch fresh sheet data for context
    let sheetData = null;
    const isDataQuery = content.toLowerCase().includes("column") ||
                        content.toLowerCase().includes("row") ||
                        content.toLowerCase().includes("data") ||
                        content.toLowerCase().includes("sheet") ||
                        content.toLowerCase().includes("summarize") ||
                        content.toLowerCase().includes("find") ||
                        content.toLowerCase().includes("show") ||
                        content.toLowerCase().includes("getsheetinfo");
    
    if (isDataQuery && sheetId) {
      try {
        console.log(`Fetching sheet info for sheet ID: ${sheetId} based on query: "${content}"`);
        const hasAccess = await verifySheetAccess(sheetId);
        if (!hasAccess) {
          throw new Error(`Unable to access sheet with ID: ${sheetId}. Please check your permissions.`);
        }
        try {
          const sheetInfo = await getSheetInfo({ sheetId });
          sheetData = sheetInfo.data;
          if (content.toLowerCase() === "getsheetinfo") {
            const systemResponse: Message = {
              role: "assistant",
              content: `I've retrieved the sheet information. The sheet "${sheetData.sheetName}" has ${sheetData.columns.length} columns and ${sheetData.rows.length} rows.`,
              metadata: {
                id: crypto.randomUUID(),
                type: "ASSISTANT",
                timestamp: new Date().toISOString(),
                sessionId,
                status: "complete"
              }
            };
            await storage.addMessage(sessionId, systemResponse);
          }
          await storage.updateSessionMetadata(sessionId, {
            sheetData: {
              columns: sheetData.columns,
              sampleData: sheetData.rows.slice(0, 5),
              sheetName: sheetData.sheetName,
              totalRows: sheetData.totalRows,
              lastUpdated: new Date().toISOString()
            }
          });
        } catch (sheetError) {
          console.error("Error getting sheet data:", sheetError);
          throw new Error(`Failed to retrieve sheet data: ${sheetError instanceof Error ? sheetError.message : "Unknown error"}`);
        }
      } catch (error) {
        console.error("Error fetching sheet info:", error);
        if (content.toLowerCase() === "getsheetinfo") {
          const errorMessage: Message = {
            role: "assistant",
            content: `I'm sorry, I encountered an error retrieving the sheet information: ${error instanceof Error ? error.message : "Unknown error"}. Please verify the sheet ID and your access permissions.`,
            metadata: {
              id: crypto.randomUUID(),
              type: "ERROR",
              timestamp: new Date().toISOString(),
              sessionId,
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error"
            }
          };
          await storage.addMessage(sessionId, errorMessage);
          return res.status(500).json(errorMessage);
        }
        console.log("Continuing with stored metadata due to error fetching fresh data");
      }
    }

    // Format messages for LLM
    const chatMessages: ChatMessage[] = allMessages.map(msg => ({
      role: msg.role || "user",
      content: msg.content,
      name: msg.name
    }));

    // Integrate LLM context enhancement:
    const defaultSystemContent = `You are an AI assistant that helps users analyze and interact with their Smartsheet data.
You have access to a Smartsheet with ID ${sheetId}.`;
    const systemMessageIndex = chatMessages.findIndex(msg => msg.role === "system");
    const originalSystemContent = systemMessageIndex !== -1 ? chatMessages[systemMessageIndex].content : defaultSystemContent;
    const sheetContext = sheetId ? await loadSheetData(sheetId) : "";
    const enhancedSystemContent = sheetContext ? enhanceSystemPrompt(originalSystemContent, sheetContext) : originalSystemContent;
    if (systemMessageIndex !== -1) {
      chatMessages[systemMessageIndex].content = enhancedSystemContent;
    } else {
      chatMessages.unshift({
        role: "system",
        content: enhancedSystemContent,
        name: undefined
      });
    }
    
    // Prune conversation messages to manage context length
    const prunedMessages = pruneConversationMessages(chatMessages, 4000);

    // Get AI response
    const completion = await getChatCompletion({
      messages: prunedMessages,
      tools: [] // Tools can be defined as needed
    });

    if (!completion.success) {
      const errorMessage: Message = {
        role: "assistant",
        content: "I'm sorry, I encountered an error processing your request. Please try again later.",
        metadata: {
          id: crypto.randomUUID(),
          type: "ERROR",
          timestamp: new Date().toISOString(),
          sessionId,
          status: "error",
          error: completion.error.message
        }
      };
      await storage.addMessage(sessionId, errorMessage);
      return res.status(500).json(errorMessage);
    }

    const assistantMessage = completion.result.choices[0].message;
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const { name, arguments: argsJson } = toolCall.function;
          let args;
          try {
            args = JSON.parse(argsJson);
          } catch (parseError) {
            console.error(`Error parsing arguments for tool ${name}:`, parseError);
            return {
              toolCall,
              result: {
                success: false,
                error: {
                  message: `Invalid JSON in arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                  code: "INVALID_ARGUMENTS"
                }
              }
            };
          }
          const result = await toolExecutor.executeToolCall(sheetId, name, args);
          return { toolCall, result };
        })
      );
      const toolResultMessages = toolResults.map(({ toolCall, result }) => {
        let content;
        if (result.success) {
          content = JSON.stringify({ status: "success", data: result.data });
        } else {
          content = JSON.stringify({ status: "error", error: result.error?.message || "Unknown error", code: result.error?.code, details: result.error?.details });
        }
        return {
          role: "function",
          name: toolCall.function.name,
          content
        };
      });
      const updatedMessages = [
        ...chatMessages,
        { role: assistantMessage.role, content: assistantMessage.content || "" },
        ...toolResultMessages.map(msg => ({ role: msg.role, content: msg.content || "", name: msg.name }))
      ];
      const followUpCompletion = await getChatCompletion({ messages: updatedMessages });
      if (!followUpCompletion.success) {
        throw new Error("Failed to get follow-up response");
      }
      const followUpMessage = followUpCompletion.result.choices[0].message;
      const responseMessage: Message = {
        role: "assistant",
        content: followUpMessage.content || "I've processed your request.",
        metadata: {
          id: crypto.randomUUID(),
          type: "ASSISTANT",
          timestamp: new Date().toISOString(),
          sessionId,
          status: "complete"
        }
      };
      await storage.addMessage(sessionId, responseMessage);
      return res.json({
        ...responseMessage,
        toolResults: toolResults.map(({ toolCall, result }) => ({
          tool: toolCall.function.name,
          success: result.success,
          result: result.success ? result.data : undefined,
          error: result.success ? undefined : result.error?.message
        }))
      });
    } else {
      const responseMessage: Message = {
        role: "assistant",
        content: assistantMessage.content || "I'm not sure how to respond to that.",
        metadata: {
          id: crypto.randomUUID(),
          type: "ASSISTANT",
          timestamp: new Date().toISOString(),
          sessionId,
          status: "complete"
        }
      };
      await storage.addMessage(sessionId, responseMessage);
      return res.json(responseMessage);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    const errorMessage: Message = {
      role: "assistant",
      content: "I'm sorry, I encountered an error processing your request. Please try again later.",
      metadata: {
        id: crypto.randomUUID(),
        type: "ERROR",
        timestamp: new Date().toISOString(),
        sessionId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      }
    };
    try {
      await storage.addMessage(sessionId, errorMessage);
    } catch (storageError) {
      console.error("Error saving error message:", storageError);
    }
    res.status(500).json(errorMessage);
  }
});

// DELETE /api/messages - Clear messages for a session
router.delete("/", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "sessionId is required"
    });
  }

  try {
    await storage.clearMessages(sessionId);
    res.json({
      success: true,
      message: "Messages cleared successfully"
    });
  } catch (error) {
    console.error("Error clearing messages:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
