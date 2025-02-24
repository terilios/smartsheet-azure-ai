import { type ColumnType } from "@shared/schema";
import { columnTypeMapping } from "@shared/schema";

// Smartsheet client configuration
let accessToken: string | null = null;
let client: any = null;

function setAccessToken(token: string): void {
  accessToken = token;
  client = null; // Reset client so it will be recreated with new token
}

async function ensureClient(): Promise<any> {
  if (!accessToken) {
    throw new Error("Smartsheet access token not configured");
  }

  if (!client) {
    // Initialize client with access token
    // This is a placeholder - you would typically initialize your actual Smartsheet client here
    client = {
      token: accessToken,
      sheets: {
        getSheet: async (sheetId: string) => {
          // Implement actual Smartsheet API call
          throw new Error("Not implemented");
        },
        updateRow: async (sheetId: string, rowId: string, data: any) => {
          // Implement actual Smartsheet API call
          throw new Error("Not implemented");
        }
      }
    };
  }

  return client;
}

interface SheetInfoRequest {
  sheetId: string;
  [key: string]: any;
}

async function getSheetInfo(params: SheetInfoRequest) {
  const client = await ensureClient();
  return client.sheets.getSheet(params.sheetId);
}

function mapSmartsheetColumnType(type: string): ColumnType {
  // Convert to uppercase and normalize
  const normalizedType = type.toUpperCase().replace(/[^A-Z_]/g, '_');
  
  // Check if it's a valid type
  const mappedType = columnTypeMapping[normalizedType as keyof typeof columnTypeMapping];
  if (!mappedType) {
    // Default to TEXT_NUMBER if no mapping found
    return "TEXT_NUMBER";
  }
  return mappedType;
}

function getColumnType(column: any): ColumnType {
  if (!column || !column.type) {
    return "TEXT_NUMBER";
  }

  // Normalize the type string
  const normalizedType = column.type.toUpperCase().replace(/[^A-Z_]/g, '_');

  switch (normalizedType) {
    case "TEXT_NUMBER":
    case "DATE":
    case "CHECKBOX":
    case "PICKLIST":
    case "CONTACT_LIST":
    case "TEXT":
    case "NUMBER":
    case "SYSTEM":
      return normalizedType as ColumnType;
    default:
      return mapSmartsheetColumnType(normalizedType);
  }
}

function validateColumnType(type: string): ColumnType {
  const normalizedType = type.toUpperCase().replace(/[^A-Z_]/g, '_');
  if (normalizedType in columnTypeMapping) {
    return normalizedType as ColumnType;
  }
  return "TEXT_NUMBER";
}

function isValidColumnType(type: string): boolean {
  const normalizedType = type.toUpperCase().replace(/[^A-Z_]/g, '_');
  return normalizedType in columnTypeMapping;
}

function getDefaultValueForType(type: ColumnType): any {
  switch (type) {
    case "TEXT_NUMBER":
    case "TEXT":
      return "";
    case "NUMBER":
      return 0;
    case "DATE":
      return null;
    case "CHECKBOX":
      return false;
    case "PICKLIST":
    case "CONTACT_LIST":
      return [];
    case "SYSTEM":
      return null;
    default:
      return null;
  }
}

export const smartsheetTools = {
  mapSmartsheetColumnType,
  getColumnType,
  validateColumnType,
  isValidColumnType,
  getDefaultValueForType,
  setAccessToken,
  ensureClient,
  getSheetInfo,
};

// Also export individual functions for direct imports
export {
  mapSmartsheetColumnType,
  getColumnType,
  validateColumnType,
  isValidColumnType,
  getDefaultValueForType,
  setAccessToken,
  ensureClient,
  getSheetInfo,
  type SheetInfoRequest,
};
