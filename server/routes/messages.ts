import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { getChatCompletion, type ChatMessage } from "../services/llm.js";
import { type Message } from "@shared/schema";
import { getSheetInfo } from "../tools/smartsheet.js";
import crypto from "crypto";

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
    
    // Check for special commands
    let sheetData = null;
    if (content.toLowerCase().includes("getsheetinfo") || content.toLowerCase() === "getsheetinfo") {
      try {
        console.log(`Fetching sheet info for sheet ID: ${sheetId}`);
        const sheetInfo = await getSheetInfo({ sheetId });
        sheetData = sheetInfo.data;
        
        // Add a system message with the sheet info
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
      } catch (error) {
        console.error("Error fetching sheet info:", error);
        const errorMessage: Message = {
          role: "assistant",
          content: "I'm sorry, I encountered an error retrieving the sheet information. Please try again later.",
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
    }

    // Format messages for LLM
    const chatMessages: ChatMessage[] = allMessages.map(msg => ({
      role: msg.role || "user", // Ensure role is never undefined
      content: msg.content,
      name: msg.name
    }));

    // Add system message with sheet data context if available
    let systemContent = `You are an AI assistant that helps users analyze and interact with their Smartsheet data.
    The current sheet ID is ${sheetId}.`;
    
    if (sheetData) {
      systemContent += `\n\nSheet Information:
      Name: ${sheetData.sheetName}
      Columns: ${sheetData.columns.map((col: { title: string }) => col.title).join(', ')}
      Total Rows: ${sheetData.totalRows}
      
      Sample data from the first few rows:
      ${JSON.stringify(sheetData.rows.slice(0, 3), null, 2)}
      
      When analyzing this data, provide specific insights based on the actual content.`;
    } else {
      systemContent += `\nProvide helpful, concise responses about the data and assist with any operations the user wants to perform.`;
    }

    // Add system message if not present or replace it with updated context
    const systemMessageIndex = chatMessages.findIndex(msg => msg.role === "system");
    if (systemMessageIndex >= 0) {
      chatMessages[systemMessageIndex] = {
        role: "system",
        content: systemContent,
        name: undefined
      };
    } else {
      chatMessages.unshift({
        role: "system",
        content: systemContent,
        name: undefined
      });
    }

    // Get AI response
    const completion = await getChatCompletion({
      messages: chatMessages
    });

    if (!completion.success) {
      // Handle LLM error
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

    // Process successful response
    const assistantMessage = completion.result.choices[0].message;
    
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
    
    res.json(responseMessage);
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