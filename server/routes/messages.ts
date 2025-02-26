import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { getChatCompletion, type ChatMessage, type ChatCompletionTool } from "../services/llm.js";
import { type Message } from "@shared/schema";
import {
  getSheetInfo,
  verifySheetAccess,
  updateCell,
  addColumn,
  deleteColumn,
  updateColumn,
  getRowById,
  deleteRow,
  addRow,
  filterRows,
  bulkUpdate,
  type FilterCriteria
} from "../tools/smartsheet.js";
import { WebSocketService } from "../services/websocket.js";
import crypto from "crypto";

// Create a tool executor service to handle tool calls
class ToolExecutor {
  async executeToolCall(sheetId: string, name: string, args: any) {
    console.log(`Executing tool: ${name} with args:`, args);
    
    try {
      switch (name) {
        case "getColumnData":
          return await this.executeGetColumnData(sheetId, args);
        case "updateCell":
          return await this.executeUpdateCell(sheetId, args);
        case "addColumn":
          return await this.executeAddColumn(sheetId, args);
        case "deleteColumn":
          return await this.executeDeleteColumn(sheetId, args);
        case "updateColumn":
          return await this.executeUpdateColumn(sheetId, args);
        case "getRowById":
          return await this.executeGetRowById(sheetId, args);
        case "deleteRow":
          return await this.executeDeleteRow(sheetId, args);
        case "addRow":
          return await this.executeAddRow(sheetId, args);
        case "filterRows":
          return await this.executeFilterRows(sheetId, args);
        case "bulkUpdate":
          return await this.executeBulkUpdate(sheetId, args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      throw error;
    }
  }
  
  private async executeGetColumnData(sheetId: string, args: { columnName: string }) {
    // Get sheet info to find column ID
    const sheetInfo = await getSheetInfo({ sheetId });
    const column = sheetInfo.data.columns.find((col: any) => col.title === args.columnName);
    
    if (!column) {
      throw new Error(`Column "${args.columnName}" not found in sheet`);
    }
    
    // Extract column data from rows
    const values = sheetInfo.data.rows.map((row: any) => row[args.columnName]);
    
    return {
      columnName: args.columnName,
      columnId: column.id,
      values
    };
  }
  
  private async executeUpdateCell(sheetId: string, args: { rowId: string, columnName: string, value: any }) {
    const result = await updateCell(sheetId, args.rowId, args.columnName, args.value);
    
    // Notify clients of the update via WebSocket
    const wsService = WebSocketService.getInstance();
    wsService.broadcastCellUpdate(sheetId, args.rowId, args.columnName, args.value);
    
    return result;
  }
  
  private async executeAddColumn(sheetId: string, args: { title: string, type: string, options?: any }) {
    return await addColumn(sheetId, args.title, args.type as any, args.options);
  }
  
  private async executeDeleteColumn(sheetId: string, args: { columnId: string }) {
    return await deleteColumn(sheetId, args.columnId);
  }
  
  private async executeUpdateColumn(sheetId: string, args: { columnId: string, updates: any }) {
    return await updateColumn(sheetId, args.columnId, args.updates);
  }
  
  private async executeGetRowById(sheetId: string, args: { rowId: string }) {
    return await getRowById(sheetId, args.rowId);
  }
  
  private async executeDeleteRow(sheetId: string, args: { rowId: string }) {
    return await deleteRow(sheetId, args.rowId);
  }
  
  private async executeAddRow(sheetId: string, args: { cells: { columnId: number, value: any }[] }) {
    return await addRow(sheetId, args.cells);
  }
  
  private async executeFilterRows(sheetId: string, args: { criteria: FilterCriteria[] }) {
    return await filterRows(sheetId, args.criteria);
  }
  
  private async executeBulkUpdate(sheetId: string, args: { criteria: FilterCriteria[], updates: { columnId: string, value: any }[] }) {
    return await bulkUpdate(sheetId, args.criteria, args.updates);
  }
}

const toolExecutor = new ToolExecutor();

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
        
        // First verify sheet access
        const hasAccess = await verifySheetAccess(sheetId);
        if (!hasAccess) {
          throw new Error(`Unable to access sheet with ID: ${sheetId}. Please check your permissions.`);
        }
        
        // Then get sheet info with improved error handling
        try {
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
        } catch (sheetError) {
          console.error("Error getting sheet data:", sheetError);
          throw new Error(`Failed to retrieve sheet data: ${sheetError instanceof Error ? sheetError.message : "Unknown error"}`);
        }
      } catch (error) {
        console.error("Error fetching sheet info:", error);
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
      Columns: ${sheetData.columns.map((col: { title: string, type: string }) =>
        `${col.title} (${col.type})`).join(', ')}
      Total Rows: ${sheetData.totalRows}
      
      Column Structure:
      ${JSON.stringify(sheetData.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        type: col.type
      })), null, 2)}
      
      Sample data from the first few rows:
      ${JSON.stringify(sheetData.rows.slice(0, 3), null, 2)}
      
      You can perform the following operations on this sheet:
      
      Column Operations:
      - Add new columns with specified types and options
      - Get column information and data
      - Update column properties (title, options, etc.)
      - Delete columns from the sheet
      
      Row Operations:
      - Add new rows with specified data
      - Get row data by ID
      - Update row data
      - Delete rows from the sheet
      
      Cell Operations:
      - Get the value of a specific cell
      - Update the value of a specific cell
      
      Bulk Operations:
      - Filter rows based on criteria
      - Update multiple rows based on criteria
      
      When analyzing this data, provide specific insights based on the actual content.
      Use the available tools to help the user interact with their sheet data.`;
    } else {
      systemContent += `\nProvide helpful, concise responses about the data and assist with any operations the user wants to perform.`;
    }

    // Define tools for the LLM
    const tools: ChatCompletionTool[] = [
      // Column operations
      {
        type: "function",
        function: {
          name: "getColumnData",
          description: "Get data from a specific column in the sheet",
          parameters: {
            type: "object",
            properties: {
              columnName: {
                type: "string",
                description: "The name of the column to retrieve data from"
              }
            },
            required: ["columnName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "addColumn",
          description: "Add a new column to the sheet",
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "The title of the new column"
              },
              type: {
                type: "string",
                description: "The type of the column (TEXT_NUMBER, DATE, CHECKBOX, PICKLIST, CONTACT_LIST)",
                enum: ["TEXT_NUMBER", "DATE", "CHECKBOX", "PICKLIST", "CONTACT_LIST", "TEXT", "NUMBER"]
              },
              options: {
                type: "object",
                description: "Additional options for the column",
                properties: {
                  index: {
                    type: "number",
                    description: "Position index for the column (optional)"
                  },
                  validation: {
                    type: "boolean",
                    description: "Enable validation for the column (optional)"
                  },
                  formula: {
                    type: "string",
                    description: "Formula for calculated columns (optional)"
                  },
                  picklistOptions: {
                    type: "array",
                    description: "Options for PICKLIST type (optional)",
                    items: {
                      type: "string"
                    }
                  }
                }
              }
            },
            required: ["title", "type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "updateColumn",
          description: "Update an existing column in the sheet",
          parameters: {
            type: "object",
            properties: {
              columnId: {
                type: "string",
                description: "The ID of the column to update"
              },
              updates: {
                type: "object",
                description: "The updates to apply to the column",
                properties: {
                  title: {
                    type: "string",
                    description: "New title for the column (optional)"
                  },
                  index: {
                    type: "number",
                    description: "New position index for the column (optional)"
                  },
                  validation: {
                    type: "boolean",
                    description: "Enable/disable validation for the column (optional)"
                  },
                  formula: {
                    type: "string",
                    description: "New formula for calculated columns (optional)"
                  },
                  options: {
                    type: "array",
                    description: "New options for PICKLIST type (optional)",
                    items: {
                      type: "string"
                    }
                  }
                }
              }
            },
            required: ["columnId", "updates"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteColumn",
          description: "Delete a column from the sheet",
          parameters: {
            type: "object",
            properties: {
              columnId: {
                type: "string",
                description: "The ID of the column to delete"
              }
            },
            required: ["columnId"]
          }
        }
      },
      
      // Row operations
      {
        type: "function",
        function: {
          name: "getRowById",
          description: "Get a specific row by ID",
          parameters: {
            type: "object",
            properties: {
              rowId: {
                type: "string",
                description: "The ID of the row to retrieve"
              }
            },
            required: ["rowId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "addRow",
          description: "Add a new row to the sheet",
          parameters: {
            type: "object",
            properties: {
              cells: {
                type: "array",
                description: "The cells to add to the row",
                items: {
                  type: "object",
                  properties: {
                    columnId: {
                      type: "number",
                      description: "The ID of the column"
                    },
                    value: {
                      type: "string",
                      description: "The value for the cell"
                    }
                  },
                  required: ["columnId", "value"]
                }
              }
            },
            required: ["cells"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "deleteRow",
          description: "Delete a row from the sheet",
          parameters: {
            type: "object",
            properties: {
              rowId: {
                type: "string",
                description: "The ID of the row to delete"
              }
            },
            required: ["rowId"]
          }
        }
      },
      
      // Cell operations
      {
        type: "function",
        function: {
          name: "updateCell",
          description: "Update a cell value in the sheet",
          parameters: {
            type: "object",
            properties: {
              rowId: {
                type: "string",
                description: "The ID of the row to update"
              },
              columnName: {
                type: "string",
                description: "The name of the column to update"
              },
              value: {
                type: "string",
                description: "The new value for the cell"
              }
            },
            required: ["rowId", "columnName", "value"]
          }
        }
      },
      
      // Bulk operations
      {
        type: "function",
        function: {
          name: "filterRows",
          description: "Filter rows based on criteria",
          parameters: {
            type: "object",
            properties: {
              criteria: {
                type: "array",
                description: "The filter criteria",
                items: {
                  type: "object",
                  properties: {
                    columnId: {
                      type: "string",
                      description: "The ID of the column to filter on"
                    },
                    operator: {
                      type: "string",
                      description: "The filter operator",
                      enum: ["equals", "contains", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"]
                    },
                    value: {
                      type: "string",
                      description: "The value to compare against (not needed for isEmpty/isNotEmpty)"
                    }
                  },
                  required: ["columnId", "operator"]
                }
              }
            },
            required: ["criteria"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "bulkUpdate",
          description: "Update multiple rows based on criteria",
          parameters: {
            type: "object",
            properties: {
              criteria: {
                type: "array",
                description: "The filter criteria to select rows",
                items: {
                  type: "object",
                  properties: {
                    columnId: {
                      type: "string",
                      description: "The ID of the column to filter on"
                    },
                    operator: {
                      type: "string",
                      description: "The filter operator",
                      enum: ["equals", "contains", "greaterThan", "lessThan", "isEmpty", "isNotEmpty"]
                    },
                    value: {
                      type: "string",
                      description: "The value to compare against (not needed for isEmpty/isNotEmpty)"
                    }
                  },
                  required: ["columnId", "operator"]
                }
              },
              updates: {
                type: "array",
                description: "The updates to apply to matching rows",
                items: {
                  type: "object",
                  properties: {
                    columnId: {
                      type: "string",
                      description: "The ID or name of the column to update"
                    },
                    value: {
                      type: "string",
                      description: "The new value for the column"
                    }
                  },
                  required: ["columnId", "value"]
                }
              }
            },
            required: ["criteria", "updates"]
          }
        }
      }
    ];

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

    // Get AI response with tools
    const completion = await getChatCompletion({
      messages: chatMessages,
      tools: tools
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
    
    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Process tool calls using the ToolExecutor
      const toolResults = await Promise.all(
        assistantMessage.tool_calls.map(async (toolCall) => {
          const { name, arguments: argsJson } = toolCall.function;
          const args = JSON.parse(argsJson);
          
          try {
            // Execute the tool using the ToolExecutor
            const result = await toolExecutor.executeToolCall(sheetId, name, args);
            
            return {
              toolCall,
              result: JSON.stringify(result)
            };
          } catch (error) {
            console.error(`Error executing tool ${name}:`, error);
            return {
              toolCall,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );
      
      // Create a follow-up message with tool results
      const toolResultMessages = toolResults.map(({ toolCall, result, error }) => ({
        role: "function" as const,
        name: toolCall.function.name,
        content: error ? `Error: ${error}` : result
      }));
      
      // Add tool result messages to the conversation
      const updatedMessages = [
        ...chatMessages,
        {
          role: assistantMessage.role,
          content: assistantMessage.content || ""
        } as ChatMessage,
        ...toolResultMessages.map(msg => ({
          role: msg.role,
          content: msg.content || "",
          name: msg.name
        } as ChatMessage))
      ];
      
      // Get a follow-up response from the LLM
      const followUpCompletion = await getChatCompletion({
        messages: updatedMessages
      });
      
      if (!followUpCompletion.success) {
        throw new Error("Failed to get follow-up response");
      }
      
      const followUpMessage = followUpCompletion.result.choices[0].message;
      
      // Save the assistant's response
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
        toolResults: toolResults.map(({ toolCall, result, error }) => ({
          tool: toolCall.function.name,
          success: !error,
          result: error ? undefined : result,
          error
        }))
      });
    } else {
      // Regular response without tool calls
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