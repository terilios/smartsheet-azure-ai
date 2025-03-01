import { type ColumnType } from "@shared/schema";
import { columnTypeMapping } from "@shared/schema";
import { WebSocketService } from "../services/websocket.js";
import { withRetry } from '../utils/retry';
import { serverEventBus, ServerEventType } from "../services/events.js";

// Filter criteria for row filtering
export interface FilterCriteria {
  columnId: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value?: any;
}

// Cell update for bulk operations
export interface CellUpdate {
  columnId: string;
  value: any;
}

// Smartsheet client configuration
let accessToken: string | null = null;
let client: any = null;

function setAccessToken(token: string): void {
  if (!token) {
    console.error('Attempted to set empty Smartsheet access token');
    throw new Error('Smartsheet access token cannot be empty');
  }
  
  console.log(`Setting Smartsheet access token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
  accessToken = token;
  client = null; // Reset client so it will be recreated with new token
  
  // Verify the token immediately
  verifyToken().catch(error => {
    console.error('Error verifying Smartsheet access token:', error);
    // Don't throw here, just log the error
  });
}

async function verifyToken(): Promise<boolean> {
  try {
    const client = await ensureClient();
    // Try a simple API call to verify the token
    await client.users.getCurrentUser();
    
    serverEventBus.publish(ServerEventType.SMARTSHEET_TOKEN_VERIFIED, {
      message: 'Successfully verified Smartsheet access token',
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    serverEventBus.publish(ServerEventType.SMARTSHEET_TOKEN_INVALID, {
      message: 'Failed to verify Smartsheet access token',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    
    return false;
  }
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
        // Improved error handling with better logging
        console.error('Smartsheet API error:', error);
        
        // Handle undefined or malformed error objects
        if (!error) {
          throw new Error('Unknown Smartsheet API error (error object is undefined)');
        }
        
        // Handle errors with missing status property
        if (error.statusCode === undefined && error.message && error.message.includes('status')) {
          console.error('Error accessing status property:', error.message);
          throw new Error('Smartsheet API connection error. Please try again later.');
        }
        
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
        
        // Handle network errors
        if (error.message && (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('network')
        )) {
          throw new Error('Network error connecting to Smartsheet API. Please check your internet connection.');
        }
        
        // Rethrow with more context if possible
        if (error.message) {
          throw new Error(`Smartsheet API error: ${error.message}`);
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
    
    // Add additional error handling around the API call
    let response;
    try {
      response = await client.sheets.getSheet({ id: params.sheetId });
    } catch (error: any) {
      console.error(`Error fetching sheet with ID ${params.sheetId}:`, error);
      if (error.statusCode === 404) {
        throw new Error(`Sheet with ID ${params.sheetId} not found. Please verify the sheet ID.`);
      } else if (error.statusCode === 403) {
        throw new Error(`You don't have permission to access sheet with ID ${params.sheetId}.`);
      } else {
        throw new Error(`Failed to fetch sheet data: ${error.message || 'Unknown error'}`);
      }
    }
    
    // Validate response structure
    if (!response) {
      throw new Error('No response received from Smartsheet API');
    }
    
    console.log(`Raw sheet data received: name=${response.name || 'unnamed'}, columns=${response.columns?.length || 0}, rows=${response.rows?.length || 0}`);
    
    if (!response.columns || !response.rows) {
      console.error('Missing columns or rows in sheet response:', response);
      throw new Error('Invalid sheet data: missing columns or rows');
    }
    
    // Format columns according to the schema
    const columns = response.columns.map((column: any) => {
      try {
        console.log(`Processing column: ${column.title || 'unnamed'} (${column.type || 'unknown type'})`);
        return {
          id: column.id ? column.id.toString() : `unknown-${Math.random().toString(36).substring(2, 9)}`,
          title: column.title || 'Unnamed Column',
          type: getColumnType(column),
          isEditable: !column.locked,
          options: column.options || [],
          description: column.description || '',
          systemColumn: column.systemColumnType ? true : false
        };
      } catch (columnError) {
        console.error(`Error processing column:`, column, columnError);
        // Return a default column rather than failing the entire operation
        return {
          id: `error-${Math.random().toString(36).substring(2, 9)}`,
          title: column.title || 'Error Processing Column',
          type: 'TEXT_NUMBER' as ColumnType,
          isEditable: false,
          options: [],
          description: 'Error processing column data',
          systemColumn: false
        };
      }
    });
    
    // Format rows according to the schema with improved error handling
    const rows = response.rows.map((row: any, rowIndex: number) => {
      try {
        const rowData: Record<string, any> = {
          id: row.id ? row.id.toString() : `unknown-${Math.random().toString(36).substring(2, 9)}`
        };
        
        // Map cell values to column titles
        if (row.cells && Array.isArray(row.cells)) {
          row.cells.forEach((cell: any, index: number) => {
            if (index < response.columns.length) {
              const column = response.columns[index];
              if (column && column.title) {
                rowData[column.title] = cell.value;
              }
            }
          });
        }
        
        if (rowIndex < 3) {
          console.log(`Sample row ${rowIndex} data:`, rowData);
        }
        
        return rowData;
      } catch (rowError) {
        console.error(`Error processing row at index ${rowIndex}:`, row, rowError);
        // Return a minimal row rather than failing
        return {
          id: `error-${Math.random().toString(36).substring(2, 9)}`,
          error: 'Error processing row data'
        };
      }
    });
    
    console.log(`Processed ${columns.length} columns and ${rows.length} rows`);
    
    const result = {
      data: {
        sheetId: params.sheetId,
        sheetName: response.name || 'Unnamed Sheet',
        columns: columns,
        rows: rows,
        totalRows: response.totalRows || rows.length,
        lastUpdated: new Date().toISOString()
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
  serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
    message: `Verifying access to sheet ${sheetId}...`,
    timestamp: new Date().toISOString()
  });
  
  if (!accessToken) {
    serverEventBus.publish(ServerEventType.SMARTSHEET_ERROR, {
      message: 'No access token set for Smartsheet API',
      timestamp: new Date().toISOString()
    });
    return false;
  }
  
  try {
    // Use a direct approach with better error handling
    try {
      const client = await ensureClient();
      console.log('Smartsheet client initialized, attempting to get sheet...');
      
      // Just try to get the sheet - if it succeeds, we have access
      // Use a minimal request to reduce data transfer
      const response = await client.sheets.getSheet({
        id: sheetId,
        include: 'name,totalRows', // Only request minimal data
        exclude: 'rows,columns,attachments,discussions,forms,source' // Exclude unnecessary data
      });
      
      if (response && response.name) {
        serverEventBus.publish(ServerEventType.SMARTSHEET_SHEET_ACCESS_GRANTED, {
          message: `Successfully accessed sheet: ${response.name}`,
          sheetId,
          sheetName: response.name,
          timestamp: new Date().toISOString()
        });
        return true;
      } else {
        serverEventBus.publish(ServerEventType.SMARTSHEET_SHEET_ACCESS_DENIED, {
          message: 'Sheet access verification failed: Invalid response format',
          sheetId,
          reason: 'invalid_response',
          timestamp: new Date().toISOString()
        });
        return false;
      }
    } catch (apiError: any) {
      let reason = 'unknown';
      let message = `API error verifying access to sheet ${sheetId}`;
      
      if (apiError.statusCode === 404) {
        reason = 'not_found';
        message = `Sheet not found: ${sheetId}`;
      } else if (apiError.statusCode === 403) {
        reason = 'permission_denied';
        message = `Permission denied for sheet: ${sheetId}`;
      } else if (apiError.statusCode === 401) {
        reason = 'authentication_failed';
        message = `Authentication failed for sheet: ${sheetId}`;
      }
      
      serverEventBus.publish(ServerEventType.SMARTSHEET_SHEET_ACCESS_DENIED, {
        message,
        sheetId,
        reason,
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
        statusCode: apiError.statusCode,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  } catch (error: any) {
    serverEventBus.publish(ServerEventType.SMARTSHEET_ERROR, {
      message: `Unexpected error verifying access to sheet ${sheetId}`,
      sheetId,
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode: error.statusCode,
      timestamp: new Date().toISOString()
    });
    
    return false;
  }
}

async function updateCell(sheetId: string, rowId: string, columnName: string, value: any) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // First, get the sheet to find the column ID
    const sheetInfo = await client.sheets.getSheet({
      id: sheetId,
      include: 'columns',
      exclude: 'rows,attachments,discussions,forms,source'
    });
    
    // Find the column by name
    const column = sheetInfo.columns.find((col: any) => col.title === columnName);
    if (!column) {
      throw new Error(`Column "${columnName}" not found in sheet`);
    }
    
    // Create the cell update
    const cell = {
      columnId: column.id,
      value: value
    };
    
    // Update the row with the new cell value
    const row = {
      id: rowId,
      cells: [cell]
    };
    
    const response = await client.sheets.updateRow({ sheetId, body: row });
    
    return {
      success: true,
      message: "Cell updated successfully",
      data: response
    };
  });
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

/**
 * Add a new column to a sheet
 * @param sheetId The ID of the sheet
 * @param title The title of the new column
 * @param type The type of the new column
 * @param options Additional options for the column
 */
async function addColumn(sheetId: string, title: string, type: ColumnType, options?: {
  index?: number;
  validation?: boolean;
  formula?: string;
  picklistOptions?: string[];
}) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // Create column specification
    const columnSpec: any = {
      title,
      type: type,
      index: options?.index
    };
    
    // Add options for picklist if provided
    if (type === 'PICKLIST' && options?.picklistOptions) {
      columnSpec.options = options.picklistOptions;
    }
    
    // Add formula if provided
    if (options?.formula) {
      columnSpec.formula = options.formula;
    }
    
    // Add validation if enabled
    if (options?.validation) {
      columnSpec.validation = true;
    }
    
    // Add the column
    const response = await client.sheets.addColumn({
      sheetId,
      body: columnSpec
    });
    
    // Notify clients of the update via WebSocket
    try {
      const wsService = WebSocketService.getInstance();
      wsService.broadcastToSheet(sheetId, {
        type: "sheet_update",
        sheetId,
        operation: "insert",
        target: "column",
        targetId: response.id,
        timestamp: new Date().toISOString(),
        change: {
          type: "column",
          action: "created",
          id: response.id,
          data: { title, type },
          timestamp: new Date().toISOString()
        }
      });
    } catch (wsError) {
      console.error("Error broadcasting column creation:", wsError);
      // Continue even if WebSocket notification fails
    }
    
    return {
      success: true,
      message: "Column added successfully",
      data: response
    };
  });
}

/**
 * Delete a column from a sheet
 * @param sheetId The ID of the sheet
 * @param columnId The ID of the column to delete
 */
async function deleteColumn(sheetId: string, columnId: string) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // Delete the column
    const response = await client.sheets.deleteColumn({
      sheetId,
      columnId
    });
    
    // Notify clients of the update via WebSocket
    try {
      const wsService = WebSocketService.getInstance();
      wsService.broadcastToSheet(sheetId, {
        type: "sheet_update",
        sheetId,
        operation: "delete",
        target: "column",
        targetId: columnId,
        timestamp: new Date().toISOString(),
        change: {
          type: "column",
          action: "deleted",
          id: columnId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (wsError) {
      console.error("Error broadcasting column deletion:", wsError);
      // Continue even if WebSocket notification fails
    }
    
    return {
      success: true,
      message: "Column deleted successfully",
      data: response
    };
  });
}

/**
 * Update a column in a sheet
 * @param sheetId The ID of the sheet
 * @param columnId The ID of the column to update
 * @param updates The updates to apply to the column
 */
async function updateColumn(sheetId: string, columnId: string, updates: {
  title?: string;
  index?: number;
  validation?: boolean;
  formula?: string;
  options?: string[];
}) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // Create column update specification
    const columnSpec: any = {
      id: columnId
    };
    
    // Add any provided updates
    if (updates.title !== undefined) columnSpec.title = updates.title;
    if (updates.index !== undefined) columnSpec.index = updates.index;
    if (updates.validation !== undefined) columnSpec.validation = updates.validation;
    if (updates.formula !== undefined) columnSpec.formula = updates.formula;
    if (updates.options !== undefined) columnSpec.options = updates.options;
    
    // Update the column
    const response = await client.sheets.updateColumn({
      sheetId,
      columnId,
      body: columnSpec
    });
    
    // Notify clients of the update via WebSocket
    try {
      const wsService = WebSocketService.getInstance();
      wsService.broadcastToSheet(sheetId, {
        type: "sheet_update",
        sheetId,
        operation: "update",
        target: "column",
        targetId: columnId,
        timestamp: new Date().toISOString(),
        change: {
          type: "column",
          action: "updated",
          id: columnId,
          data: updates,
          timestamp: new Date().toISOString()
        }
      });
    } catch (wsError) {
      console.error("Error broadcasting column update:", wsError);
      // Continue even if WebSocket notification fails
    }
    
    return {
      success: true,
      message: "Column updated successfully",
      data: response
    };
  });
}

/**
 * Get a specific row by ID
 * @param sheetId The ID of the sheet
 * @param rowId The ID of the row to retrieve
 */
async function getRowById(sheetId: string, rowId: string) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // Get the row
    const response = await client.sheets.getRow({
      sheetId,
      rowId
    });
    
    // Format the row data
    const rowData: Record<string, any> = {
      id: response.id ? response.id.toString() : rowId
    };
    
    // Get the sheet to get column information
    const sheetInfo = await client.sheets.getSheet({
      id: sheetId,
      include: 'columns',
      exclude: 'rows,attachments,discussions,forms,source'
    });
    
    // Map cell values to column titles
    if (response.cells && Array.isArray(response.cells)) {
      response.cells.forEach((cell: any, index: number) => {
        if (index < sheetInfo.columns.length) {
          const column = sheetInfo.columns[index];
          if (column && column.title) {
            rowData[column.title] = cell.value;
          }
        }
      });
    }
    
    return {
      success: true,
      message: "Row retrieved successfully",
      data: rowData
    };
  });
}

/**
 * Delete a row from a sheet
 * @param sheetId The ID of the sheet
 * @param rowId The ID of the row to delete
 */
async function deleteRow(sheetId: string, rowId: string) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // Delete the row
    const response = await client.sheets.deleteRow({
      sheetId,
      rowId
    });
    
    // Notify clients of the update via WebSocket
    try {
      const wsService = WebSocketService.getInstance();
      wsService.broadcastRowUpdate(sheetId, rowId, "deleted");
    } catch (wsError) {
      console.error("Error broadcasting row deletion:", wsError);
      // Continue even if WebSocket notification fails
    }
    
    return {
      success: true,
      message: "Row deleted successfully",
      data: response
    };
  });
}

/**
 * Filter rows based on criteria
 * @param sheetId The ID of the sheet
 * @param criteria The filter criteria
 */
async function filterRows(sheetId: string, criteria: FilterCriteria[]) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // Get the sheet data
    const sheetInfo = await getSheetInfo({ sheetId });
    const sheetData = sheetInfo.data;
    
    // Apply filters
    const filteredRows = sheetData.rows.filter((row: Record<string, any>) => {
      return criteria.every(criterion => {
        // Find the column by ID
        const column = sheetData.columns.find((col: { id: string }) => col.id === criterion.columnId);
        if (!column) return false;
        
        const value = row[column.title];
        
        switch (criterion.operator) {
          case 'equals':
            return value === criterion.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(criterion.value).toLowerCase());
          case 'greaterThan':
            return Number(value) > Number(criterion.value);
          case 'lessThan':
            return Number(value) < Number(criterion.value);
          case 'isEmpty':
            return value === undefined || value === null || value === '';
          case 'isNotEmpty':
            return value !== undefined && value !== null && value !== '';
          default:
            return false;
        }
      });
    });
    
    return {
      success: true,
      message: `Found ${filteredRows.length} matching rows`,
      data: {
        ...sheetData,
        rows: filteredRows,
        totalRows: filteredRows.length
      }
    };
  });
}

/**
 * Perform bulk updates on rows matching criteria
 * @param sheetId The ID of the sheet
 * @param criteria The filter criteria
 * @param updates The updates to apply
 */
async function bulkUpdate(sheetId: string, criteria: FilterCriteria[], updates: CellUpdate[]) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    
    // First, filter rows to find matches
    const filterResult = await filterRows(sheetId, criteria);
    const matchingRows = filterResult.data.rows;
    
    if (matchingRows.length === 0) {
      return {
        success: true,
        message: "No rows matched the criteria",
        data: { rowsAffected: 0 }
      };
    }
    
    // Get column information
    const sheetInfo = await client.sheets.getSheet({
      id: sheetId,
      include: 'columns',
      exclude: 'rows,attachments,discussions,forms,source'
    });
    
    // Prepare updates for each matching row
    const updatePromises = matchingRows.map(async (row: Record<string, any>) => {
      const rowId = row.id;
      
      // Convert column names to column IDs
      const cellUpdates = updates.map(update => {
        // If update.columnId is already a number, use it directly
        if (!isNaN(Number(update.columnId))) {
          return {
            columnId: Number(update.columnId),
            value: update.value
          };
        }
        
        // Otherwise, find the column by name
        const column = sheetInfo.columns.find((col: any) =>
          col.id.toString() === update.columnId || col.title === update.columnId
        );
        
        if (!column) {
          throw new Error(`Column "${update.columnId}" not found in sheet`);
        }
        
        return {
          columnId: column.id,
          value: update.value
        };
      });
      
      // Update the row
      return updateRow(sheetId, Number(rowId), cellUpdates);
    });
    
    // Execute all updates
    const results = await Promise.all(updatePromises);
    
    // Notify clients of the update via WebSocket
    try {
      const wsService = WebSocketService.getInstance();
      wsService.broadcastToSheet(sheetId, {
        type: "sheet_update",
        sheetId,
        operation: "update",
        target: "sheet",
        timestamp: new Date().toISOString(),
        change: {
          type: "sheet",
          action: "updated",
          id: sheetId,
          data: { rowsAffected: matchingRows.length },
          timestamp: new Date().toISOString()
        }
      });
    } catch (wsError) {
      console.error("Error broadcasting bulk update:", wsError);
      // Continue even if WebSocket notification fails
    }
    
    return {
      success: true,
      message: `Updated ${matchingRows.length} rows`,
      data: {
        rowsAffected: matchingRows.length,
        rowIds: matchingRows.map((row: Record<string, any>) => row.id)
      }
    };
  });
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
  updateCell,
  updateRow,
  addRow,
  executeWithRetry,
  verifySheetAccess,
  // New column operations
  addColumn,
  deleteColumn,
  updateColumn,
  // New row operations
  getRowById,
  deleteRow,
  // Bulk operations
  filterRows,
  bulkUpdate
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
  updateCell,
  updateRow,
  addRow,
  executeWithRetry,
  verifySheetAccess,
  // New column operations
  addColumn,
  deleteColumn,
  updateColumn,
  // New row operations
  getRowById,
  deleteRow,
  // Bulk operations
  filterRows,
  bulkUpdate,
  // Types
  type SheetInfoRequest
};
