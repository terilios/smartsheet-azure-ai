import { z } from "zod";
import smartsheet from "smartsheet";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { type ColumnMetadata, type SheetData } from "../../shared/schema";
import { jobQueue } from "../jobs/queue.js";

// Tool schemas
export const openSheetSchema = z.object({
  sheetId: z.string().describe("The Smartsheet ID to open and display"),
});

export const addColumnSchema = z.object({
  columnName: z.string().describe("The name of the column to add"),
  columnType: z.enum(["TEXT_NUMBER", "DATE", "CONTACT_LIST", "CHECKBOX"])
    .default("TEXT_NUMBER")
    .describe("The type of column to add"),
});

export const getSheetInfoSchema = z.object({
  sheetId: z.string().describe("The Smartsheet ID to get info about"),
});

export const getSheetDataSchema = z.object({
  sheetId: z.string().describe("The Smartsheet ID to fetch data from"),
});

export const processBulkOperationSchema = z.object({
  sheetId: z.string(),
  sourceColumns: z.array(z.string()),
  targetColumn: z.string(),
  operation: z.object({
    type: z.enum(["SUMMARIZE", "SCORE_ALIGNMENT", "EXTRACT_TERMS"]),
    parameters: z.record(z.any()).optional()
  })
});

// Tool implementations
export class SmartsheetTools {
  private currentSheetId: string | null = null;
  private accessToken: string | null = null;
  private client: any = null;

  constructor(accessToken?: string) {
    if (accessToken) {
      this.initializeClient(accessToken);
    }
  }

  private initializeClient(accessToken: string) {
    if (!accessToken) {
      throw new Error("Smartsheet access token is required");
    }

    try {
      this.client = smartsheet.createClient({
        accessToken,
        logLevel: 'info'
      });
      this.accessToken = accessToken;
    } catch (error) {
      console.error('Failed to initialize Smartsheet client:', error);
      throw new Error("Failed to initialize Smartsheet client. Please check your access token.");
    }
  }

  private ensureClient() {
    if (!this.client) {
      const token = process.env.SMARTSHEET_ACCESS_TOKEN;
      if (!token) {
        throw new Error("SMARTSHEET_ACCESS_TOKEN environment variable must be set");
      }
      this.initializeClient(token);
    }
  }

  private isSystemColumn(title: string): boolean {
    const systemColumns = [
      'Created By', 'Created Date', 'Modified By', 'Modified Date',
      'Row ID', 'Row Number', 'Lock Record'
    ];
    return systemColumns.includes(title);
  }

  private async getColumnMetadata(column: any): Promise<ColumnMetadata> {
    const isSystem = this.isSystemColumn(column.title);
    let options: string[] | undefined;
    
    if (column.type === 'PICKLIST') {
      try {
        const response = await this.client.sheets.getColumn({
          sheetId: this.currentSheetId!,
          columnId: column.id
        });
        options = response.options?.map((opt: { value: string }) => opt.value) || [];
      } catch (error) {
        console.error(`Failed to fetch options for column ${column.title}:`, error);
      }
    }

    return {
      id: column.id,
      title: column.title,
      type: column.type,
      index: column.index,
      isEditable: !isSystem && column.type !== 'AUTO_NUMBER',
      options,
      systemColumn: isSystem,
      description: column.description
    };
  }

  private async transformSheetData(sheet: any, maxRows?: number): Promise<SheetData> {
    const columns = await Promise.all(
      sheet.columns.map((col: any) => this.getColumnMetadata(col))
    );

    const rows = sheet.rows
      .slice(0, maxRows)
      .map((row: any) => {
        const rowData: Record<string, any> = { id: row.id };
        row.cells.forEach((cell: any) => {
          const column = columns.find(col => col.id === cell.columnId);
          if (column) {
            rowData[column.title] = cell.value;
          }
        });
        return rowData;
      });

    return {
      columns,
      rows,
      sheetName: sheet.name,
      totalRows: sheet.totalRowCount,
      lastUpdated: new Date().toISOString()
    };
  }

  async getSheetInfo(params: z.infer<typeof getSheetInfoSchema>) {
    try {
      this.ensureClient();
      console.log(`Fetching info for sheet ${params.sheetId}`);
      const sheet = await this.client.sheets.getSheet({ id: params.sheetId });
      const data = await this.transformSheetData(sheet, 3); // Only get first 3 rows

      return {
        success: true,
        message: `Sheet "${data.sheetName}" has ${data.totalRows} rows and ${data.columns.length} columns. Here are the first 3 rows as a sample.`,
        data: {
          sheetId: params.sheetId,
          sheetName: data.sheetName,
          totalRows: data.totalRows,
          columns: data.columns
        }
      };
    } catch (err: any) {
      console.error('Error fetching sheet info:', JSON.stringify(err, null, 2));
      if (err.statusCode === 401) {
        throw new Error("Authentication failed. Please ensure the Smartsheet access token is valid.");
      } else if (err.statusCode === 404) {
        throw new Error(`Sheet with ID ${params.sheetId} was not found.`);
      }
      throw new Error(`Failed to fetch sheet info: ${err.message}`);
    }
  }

  async getSheetData(params: z.infer<typeof getSheetDataSchema>) {
    try {
      this.ensureClient();
      console.log(`Fetching data for sheet ${params.sheetId}`);
      const sheet = await this.client.sheets.getSheet({ id: params.sheetId });
      const data = await this.transformSheetData(sheet);

      return {
        success: true,
        message: "Sheet data fetched successfully",
        data
      };
    } catch (err: any) {
      console.error('Error fetching sheet data:', JSON.stringify(err, null, 2));
      if (err.statusCode === 401) {
        throw new Error("Authentication failed. Please ensure the Smartsheet access token is valid.");
      } else if (err.statusCode === 404) {
        throw new Error(`Sheet with ID ${params.sheetId} was not found.`);
      }
      throw new Error(`Failed to fetch sheet data: ${err.message}`);
    }
  }

  async openSheet(params: z.infer<typeof openSheetSchema>) {
    try {
      this.ensureClient();
      console.log(`Attempting to open sheet ${params.sheetId}`);
      const result = await this.getSheetInfo({ sheetId: params.sheetId });
      this.currentSheetId = params.sheetId;

      return {
        success: true,
        message: `### Success! 🎉\n\nI've loaded the Smartsheet: "${result.data.sheetName}"\nID: \`${params.sheetId}\`\n\nYou can now ask me questions about the sheet or request specific operations.`,
        metadata: { 
          sheetId: params.sheetId,
          operation: 'openSheet',
          status: 'success',
          timestamp: new Date().toISOString()
        }
      };
    } catch (err: any) {
      console.error('Error opening sheet:', JSON.stringify(err, null, 2));
      throw err;
    }
  }

  async addColumn(params: z.infer<typeof addColumnSchema>) {
    if (!this.currentSheetId) {
      throw new Error("Please open a sheet first before adding columns");
    }

    try {
      this.ensureClient();
      console.log(`Adding column ${params.columnName} to sheet ${this.currentSheetId}`);
      const response = await this.client.sheets.addColumn({
        sheetId: this.currentSheetId,
        body: {
          title: params.columnName,
          type: params.columnType,
          index: 0,
        },
      });
      console.log('Column added successfully:', response);

      return {
        success: true,
        message: `### Success! 🎉\n\nI've added a new column:\n- Name: \`${params.columnName}\`\n- Type: ${params.columnType}\n- Position: Beginning of sheet\n\nYou can now see this column in your Smartsheet view.`,
        metadata: { 
          sheetId: this.currentSheetId,
          operation: 'addColumn',
          status: 'success',
          timestamp: new Date().toISOString()
        }
      };
    } catch (err: any) {
      console.error('Error adding column:', JSON.stringify(err, null, 2));
      if (err.statusCode === 401) {
        throw new Error("Authentication failed. Please ensure the Smartsheet access token is valid and has the necessary permissions.");
      } else if (err.statusCode === 404) {
        throw new Error("The current sheet was not found. Please try opening the sheet again.");
      }
      throw new Error(`Failed to add column: ${err.message}`);
    }
  }

  async processBulkOperation(params: z.infer<typeof processBulkOperationSchema>) {
    try {
      this.ensureClient();
      
      // Create a job for bulk processing
      const jobId = await jobQueue.createJob({
        sheetId: params.sheetId,
        sourceColumns: params.sourceColumns,
        targetColumn: params.targetColumn,
        generatedPrompt: this.generatePromptForOperation(params.operation),
        outputSchema: this.getSchemaForOperation(params.operation)
      });

      return {
        success: true,
        message: `### Processing Started 🚀\n\nI've started processing the sheet with the following operation:\n- Type: ${params.operation.type}\n- Source Columns: ${params.sourceColumns.join(', ')}\n- Target Column: ${params.targetColumn}\n\nJob ID: \`${jobId}\`\n\nYou can check the status using this ID.`,
        jobId,
        metadata: {
          jobId,
          operation: params.operation.type,
          status: 'processing',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error starting bulk operation:', error);
      throw new Error(`Failed to start bulk operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generatePromptForOperation(operation: { type: string; parameters?: Record<string, any> }): string {
    switch (operation.type) {
      case 'SUMMARIZE':
        return `Analyze and summarize the following content:\n{content}\n\nProvide a concise summary that captures the key points.`;
      
      case 'SCORE_ALIGNMENT':
        return `Analyze the following content and score its alignment with Boston Children's Hospital's mission:\n{content}\n\nConsider:\n- Pediatric healthcare focus\n- Innovation and research\n- Patient-centered care\n- Family-centered approach\n\nProvide a score from 1-100 based on alignment.`;
      
      case 'EXTRACT_TERMS':
        return `Extract key terms from the following content:\n{content}\n\nIdentify and list the most important terms, focusing on medical terminology, technical concepts, and significant phrases.`;
      
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  private getSchemaForOperation(operation: { type: string; parameters?: Record<string, any> }): any {
    switch (operation.type) {
      case 'SUMMARIZE':
        return {
          type: 'object',
          required: ['summary'],
          properties: {
            summary: {
              type: 'string',
              maxLength: 500
            }
          }
        };
      
      case 'SCORE_ALIGNMENT':
        return {
          type: 'object',
          required: ['score'],
          properties: {
            score: {
              type: 'number',
              minimum: 1,
              maximum: 100
            }
          }
        };
      
      case 'EXTRACT_TERMS':
        return {
          type: 'object',
          required: ['terms'],
          properties: {
            terms: {
              type: 'array',
              items: {
                type: 'string'
              },
              maxItems: 7
            }
          }
        };
      
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }
}

// Tool definitions for OpenAI
export const smartsheetTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "openSheet",
      description: "Opens and displays a Smartsheet in the viewer",
      parameters: {
        type: "object",
        properties: {
          sheetId: {
            type: "string",
            description: "The Smartsheet ID to open and display"
          }
        },
        required: ["sheetId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "addColumn",
      description: "Adds a new column to the currently open Smartsheet",
      parameters: {
        type: "object",
        properties: {
          columnName: {
            type: "string",
            description: "The name of the column to add"
          },
          columnType: {
            type: "string",
            enum: ["TEXT_NUMBER", "DATE", "CONTACT_LIST", "CHECKBOX"],
            default: "TEXT_NUMBER",
            description: "The type of column to add"
          }
        },
        required: ["columnName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "getSheetInfo",
      description: "Get information about a Smartsheet including column headers and a few sample rows",
      parameters: {
        type: "object",
        properties: {
          sheetId: {
            type: "string",
            description: "The Smartsheet ID to get info about"
          }
        },
        required: ["sheetId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "processBulkOperation",
      description: "Process multiple rows with AI operations like summarization, scoring, or term extraction",
      parameters: {
        type: "object",
        properties: {
          sheetId: {
            type: "string",
            description: "The Smartsheet ID to process"
          },
          sourceColumns: {
            type: "array",
            items: {
              type: "string"
            },
            description: "Column IDs or titles to read from"
          },
          targetColumn: {
            type: "string",
            description: "Column ID or title to write results to"
          },
          operation: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["SUMMARIZE", "SCORE_ALIGNMENT", "EXTRACT_TERMS"],
                description: "Type of operation to perform"
              },
              parameters: {
                type: "object",
                description: "Optional parameters for the operation"
              }
            },
            required: ["type"]
          }
        },
        required: ["sheetId", "sourceColumns", "targetColumn", "operation"]
      }
    }
  }
];
