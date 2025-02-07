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
    },
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
    },
  },
];

// Tool implementations
export class SmartsheetTools {
  private client: any;
  private currentSheetId: string | null = null;

  constructor(accessToken: string) {
    this.client = smartsheet.createClient({
      accessToken,
      logLevel: "info",
    });
  }

  setCurrentSheetId(sheetId: string) {
    this.currentSheetId = sheetId;
  }

  async openSheet(params: z.infer<typeof openSheetSchema>) {
    try {
      // Verify sheet exists and is accessible
      await this.client.sheets.getSheet({ id: params.sheetId });
      this.currentSheetId = params.sheetId;

      return {
        success: true,
        message: `### Success! 🎉\n\nI've loaded the Smartsheet with ID: \`${params.sheetId}\`\n\nYou should see it in the right panel now.`,
        metadata: { sheetId: params.sheetId },
      };
    } catch (err: any) {
      if (err.statusCode === 401) {
        throw new Error("The Smartsheet access token appears to be invalid. Please contact your administrator.");
      } else if (err.statusCode === 404) {
        throw new Error(`Sheet with ID ${params.sheetId} was not found. Please verify the sheet ID and try again.`);
      }
      throw err;
    }
  }

  async addColumn(params: z.infer<typeof addColumnSchema>) {
    if (!this.currentSheetId) {
      throw new Error("Please open a sheet first before adding columns");
    }

    try {
      await this.client.sheets.addColumn({
        sheetId: this.currentSheetId,
        body: {
          title: params.columnName,
          type: params.columnType,
          index: 0,
        },
      });

      return {
        success: true,
        message: `### Success! 🎉\n\nI've added a new column:\n- Name: \`${params.columnName}\`\n- Type: ${params.columnType}\n- Position: Beginning of sheet\n\nYou can now see this column in your Smartsheet view.`,
        metadata: { sheetId: this.currentSheetId },
      };
    } catch (err: any) {
      if (err.statusCode === 401) {
        throw new Error("The Smartsheet access token appears to be invalid. Please contact your administrator.");
      } else if (err.statusCode === 404) {
        throw new Error("The current sheet was not found. Please try opening the sheet again.");
      }
      throw err;
    }
  }
}