import { z } from "zod";
import smartsheet from "smartsheet";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

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

export const getSheetDataSchema = z.object({
  sheetId: z.string().describe("The Smartsheet ID to fetch data from"),
});

// Tool implementations
export class SmartsheetTools {
  private client: any; 
  private currentSheetId: string | null = null;

  constructor(accessToken: string) {
    if (!accessToken) {
      throw new Error("SMARTSHEET_ACCESS_TOKEN environment variable must be set");
    }

    try {
      this.client = smartsheet.createClient({
        accessToken,
        logLevel: 'info'
      });
    } catch (error) {
      console.error('Failed to initialize Smartsheet client:', error);
      throw new Error("Failed to initialize Smartsheet client. Please check your access token.");
    }
  }

  async getSheetData(params: z.infer<typeof getSheetDataSchema>) {
    try {
      console.log(`Fetching data for sheet ${params.sheetId}`);
      const sheet = await this.client.sheets.getSheet({ id: params.sheetId });

      // Transform the data into a more usable format
      const columns = sheet.columns.map((col: any) => ({
        id: col.id,
        title: col.title,
        type: col.type,
        index: col.index,
      }));

      const rows = sheet.rows.map((row: any) => {
        const rowData: Record<string, any> = { id: row.id };
        row.cells.forEach((cell: any) => {
          const column = columns.find((col: any) => col.id === cell.columnId);
          if (column) {
            rowData[column.title] = cell.value;
          }
        });
        return rowData;
      });

      return {
        success: true,
        message: "Sheet data fetched successfully",
        data: {
          columns,
          rows,
          sheetName: sheet.name,
          totalRows: sheet.totalRowCount,
        }
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
      console.log(`Attempting to open sheet ${params.sheetId}`);
      const result = await this.getSheetData({ sheetId: params.sheetId });
      this.currentSheetId = params.sheetId;

      return {
        success: true,
        message: `### Success! 🎉\n\nI've loaded the Smartsheet: "${result.data.sheetName}"\nID: \`${params.sheetId}\`\n\nYou should see the data in the spreadsheet viewer now.`,
        metadata: { 
          sheetId: params.sheetId,
          sheetData: result.data
        },
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
        metadata: { sheetId: this.currentSheetId },
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
      name: "getSheetData",
      description: "Fetches data from a Smartsheet",
      parameters: {
        type: "object",
        properties: {
          sheetId: {
            type: "string",
            description: "The Smartsheet ID to fetch data from"
          }
        },
        required: ["sheetId"]
      }
    }
  }
];