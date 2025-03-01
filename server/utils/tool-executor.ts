import {
  executeToolWithRetry,
  ToolResult,
  ToolErrorCode,
  createToolError,
  createToolSuccess
} from './tool-retry';
import {
  getSheetInfo,
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

/**
 * ToolExecutor class for handling tool calls with standardized error handling and retry logic
 */
export class ToolExecutor {
  /**
   * Execute a tool call with standardized error handling and retry logic
   */
  async executeToolCall(sheetId: string, name: string, args: any): Promise<ToolResult> {
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
          return createToolError(
            `Unknown tool: ${name}`,
            ToolErrorCode.INVALID_ARGUMENTS
          );
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
      return createToolError(
        error instanceof Error ? error.message : String(error),
        ToolErrorCode.UNKNOWN_ERROR,
        error
      );
    }
  }
  
  /**
   * Validate required arguments for a tool call
   */
  private validateArgs(args: any, requiredArgs: string[]): ToolResult | null {
    for (const arg of requiredArgs) {
      if (args[arg] === undefined) {
        return createToolError(
          `Missing required argument: ${arg}`,
          ToolErrorCode.INVALID_ARGUMENTS
        );
      }
    }
    return null;
  }
  
  /**
   * Execute getColumnData tool with retry logic
   */
  private async executeGetColumnData(sheetId: string, args: { columnName: string }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['columnName']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
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
    }, 'getColumnData');
  }
  
  /**
   * Execute updateCell tool with retry logic
   */
  private async executeUpdateCell(sheetId: string, args: { rowId: string, columnName: string, value: any }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['rowId', 'columnName', 'value']);
    if (validationError) return validationError;
    
    const result = await executeToolWithRetry(async () => {
      return await updateCell(sheetId, args.rowId, args.columnName, args.value);
    }, 'updateCell');
    
    if (result.success) {
      // Notify clients of the update via WebSocket
      try {
        const wsService = WebSocketService.getInstance();
        wsService.broadcastCellUpdate(sheetId, args.rowId, args.columnName, args.value);
      } catch (wsError) {
        console.error("Error broadcasting cell update:", wsError);
        // Continue even if WebSocket notification fails
      }
    }
    
    return result;
  }
  
  /**
   * Execute addColumn tool with retry logic
   */
  private async executeAddColumn(sheetId: string, args: { title: string, type: string, options?: any }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['title', 'type']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await addColumn(sheetId, args.title, args.type as any, args.options);
    }, 'addColumn');
  }
  
  /**
   * Execute deleteColumn tool with retry logic
   */
  private async executeDeleteColumn(sheetId: string, args: { columnId: string }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['columnId']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await deleteColumn(sheetId, args.columnId);
    }, 'deleteColumn');
  }
  
  /**
   * Execute updateColumn tool with retry logic
   */
  private async executeUpdateColumn(sheetId: string, args: { columnId: string, updates: any }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['columnId', 'updates']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await updateColumn(sheetId, args.columnId, args.updates);
    }, 'updateColumn');
  }
  
  /**
   * Execute getRowById tool with retry logic
   */
  private async executeGetRowById(sheetId: string, args: { rowId: string }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['rowId']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await getRowById(sheetId, args.rowId);
    }, 'getRowById');
  }
  
  /**
   * Execute deleteRow tool with retry logic
   */
  private async executeDeleteRow(sheetId: string, args: { rowId: string }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['rowId']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await deleteRow(sheetId, args.rowId);
    }, 'deleteRow');
  }
  
  /**
   * Execute addRow tool with retry logic
   */
  private async executeAddRow(sheetId: string, args: { cells: { columnId: number, value: any }[] }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['cells']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await addRow(sheetId, args.cells);
    }, 'addRow');
  }
  
  /**
   * Execute filterRows tool with retry logic
   */
  private async executeFilterRows(sheetId: string, args: { criteria: FilterCriteria[] }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['criteria']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await filterRows(sheetId, args.criteria);
    }, 'filterRows');
  }
  
  /**
   * Execute bulkUpdate tool with retry logic
   */
  private async executeBulkUpdate(sheetId: string, args: { criteria: FilterCriteria[], updates: { columnId: string, value: any }[] }): Promise<ToolResult> {
    // Validate arguments
    const validationError = this.validateArgs(args, ['criteria', 'updates']);
    if (validationError) return validationError;
    
    return await executeToolWithRetry(async () => {
      return await bulkUpdate(sheetId, args.criteria, args.updates);
    }, 'bulkUpdate');
  }
}

// Export singleton instance
export const toolExecutor = new ToolExecutor();