import { type ColumnType } from "@shared/schema";
import { columnTypeMapping } from "@shared/schema";

import { withRetry } from '../utils/retry';

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
    try {
      // Initialize real Smartsheet client with access token
      // Use dynamic import for ES modules compatibility
      const smartsheetModule = await import('smartsheet');
      const smartsheet = smartsheetModule.default;
      
      client = smartsheet.createClient({
        accessToken,
        logLevel: 'info'
      });
      
      console.log('Smartsheet client created successfully');
    } catch (error) {
      console.error('Error creating Smartsheet client:', error);
      throw error;
    }
  }

  return client;
}

// Wrapper function with retry logic for handling token expiration
async function executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  const result = await withRetry(
    async () => {
      try {
        return await operation();
      } catch (error: any) {
        // Check if error is due to expired token or authentication issues
        if (error.statusCode === 401 ||
            (error.message && (
              error.message.includes('expired') ||
              error.message.includes('Invalid') ||
              error.message.includes('authentication')
            ))) {
          console.error('Authentication error with Smartsheet API:', error.message);
          throw new Error('Smartsheet authentication failed. Please check your access token.');
        }
        throw error;
      }
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 2
    }
  );
  
  if (!result.success) {
    throw result.error || new Error('Operation failed with unknown error');
  }
  
  if (result.result === undefined) {
    throw new Error('Operation succeeded but returned no result');
  }
  
  return result.result;
}

interface SheetInfoRequest {
  sheetId: string;
  [key: string]: any;
}

async function getSheetInfo(params: SheetInfoRequest) {
  return executeWithRetry(async () => {
    console.log(`Getting sheet info for sheet ID: ${params.sheetId}`);
    const client = await ensureClient();
    const response = await client.sheets.getSheet({ id: params.sheetId });
    
    console.log(`Raw sheet data received: name=${response.name}, columns=${response.columns?.length || 0}, rows=${response.rows?.length || 0}`);
    
    if (!response.columns || !response.rows) {
      console.error('Missing columns or rows in sheet response:', response);
      throw new Error('Invalid sheet data: missing columns or rows');
    }
    
    // Format columns according to the schema
    const columns = response.columns.map((column: any) => {
      console.log(`Processing column: ${column.title} (${column.type})`);
      return {
        id: column.id.toString(),
        title: column.title,
        type: getColumnType(column),
        isEditable: !column.locked,
        options: column.options || [],
        description: column.description,
        systemColumn: column.systemColumnType ? true : false
      };
    });
    
    // Format rows according to the schema
    const rows = response.rows.map((row: any, rowIndex: number) => {
      const rowData: Record<string, any> = {
        id: row.id.toString()
      };
      
      // Map cell values to column titles
      row.cells.forEach((cell: any, index: number) => {
        const column = response.columns[index];
        if (column) {
          rowData[column.title] = cell.value;
        }
      });
      
      if (rowIndex < 3) {
        console.log(`Sample row ${rowIndex} data:`, rowData);
      }
      
      return rowData;
    });
    
    console.log(`Processed ${columns.length} columns and ${rows.length} rows`);
    
    const result = {
      data: {
        sheetId: params.sheetId,
        sheetName: response.name,
        columns: columns,
        rows: rows,
        totalRows: response.totalRows || rows.length
      }
    };
    
    console.log('Returning formatted sheet data');
    return result;
  });
}

/**
 * Verify that a sheet exists and is accessible with the current access token
 * @param sheetId The ID of the sheet to verify
 * @returns A promise that resolves to true if the sheet is accessible, false otherwise
 */
async function verifySheetAccess(sheetId: string): Promise<boolean> {
  console.log(`Verifying access to sheet ${sheetId}...`);
  
  if (!accessToken) {
    console.error('No access token set for Smartsheet API');
    return false;
  }
  
  console.log(`Using access token: ${accessToken.substring(0, 5)}...${accessToken.substring(accessToken.length - 5)}`);
  
  try {
    // Use executeWithRetry to handle token expiration and retry logic
    const response = await executeWithRetry(async () => {
      const client = await ensureClient();
      console.log('Smartsheet client initialized, attempting to get sheet...');
      // Just try to get the sheet - if it succeeds, we have access
      return await client.sheets.getSheet({ id: sheetId });
    });
    
    console.log(`Successfully accessed sheet: ${response.name}`);
    return true;
  } catch (error: any) {
    console.error(`Error verifying access to sheet ${sheetId}:`, error);
    
    // Log more details about the error
    if (error.statusCode) {
      console.error(`Status code: ${error.statusCode}`);
    }
    
    if (error.message) {
      console.error(`Error message: ${error.message}`);
    }
    
    return false;
  }
}

async function updateRow(sheetId: string, rowId: number, cells: { columnId: number, value: any }[]) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    const row = {
      id: rowId,
      cells: cells
    };
    
    const response = await client.sheets.updateRow({ sheetId, body: row });
    
    return {
      success: true,
      message: "Row updated successfully",
      data: response
    };
  });
}

async function addRow(sheetId: string, cells: { columnId: number, value: any }[]) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    const row = { cells };
    
    const response = await client.sheets.addRow({ sheetId, body: row });
    
    return {
      success: true,
      message: "Row added successfully",
      data: response
    };
  });
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
  updateRow,
  addRow,
  executeWithRetry,
  verifySheetAccess
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
  updateRow,
  addRow,
  executeWithRetry,
  verifySheetAccess,
  type SheetInfoRequest,
};
