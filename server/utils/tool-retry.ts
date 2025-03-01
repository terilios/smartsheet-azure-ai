import { withRetry } from './retry';

/**
 * Standardized tool result interface
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * Error codes for tool execution
 */
export enum ToolErrorCode {
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

/**
 * Create a standardized error object
 */
export function createToolError(
  message: string,
  code: ToolErrorCode = ToolErrorCode.UNKNOWN_ERROR,
  details?: any
): ToolResult {
  return {
    success: false,
    error: {
      message,
      code,
      details
    }
  };
}

/**
 * Create a standardized success result
 */
export function createToolSuccess<T>(data: T): ToolResult<T> {
  return {
    success: true,
    data
  };
}

/**
 * Determine if an error is transient and should be retried
 */
export function isTransientError(error: any): boolean {
  // Check for rate limiting
  if (error.statusCode === 429 || 
      (error.message && error.message.includes('rate limit'))) {
    return true;
  }
  
  // Check for service unavailable
  if (error.statusCode === 503 || 
      (error.message && error.message.includes('service unavailable'))) {
    return true;
  }
  
  // Check for timeout
  if (error.message && (
    error.message.includes('timeout') || 
    error.message.includes('timed out')
  )) {
    return true;
  }
  
  // Check for network errors
  if (error.message && (
    error.message.includes('network') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ECONNRESET') ||
    error.message.includes('ETIMEDOUT')
  )) {
    return true;
  }
  
  return false;
}

/**
 * Map API error to tool error code
 */
export function mapErrorToToolErrorCode(error: any): ToolErrorCode {
  if (!error) return ToolErrorCode.UNKNOWN_ERROR;
  
  // Check status codes
  if (error.statusCode) {
    switch (error.statusCode) {
      case 400: return ToolErrorCode.INVALID_ARGUMENTS;
      case 401: return ToolErrorCode.PERMISSION_DENIED;
      case 403: return ToolErrorCode.PERMISSION_DENIED;
      case 404: return ToolErrorCode.NOT_FOUND;
      case 422: return ToolErrorCode.VALIDATION_ERROR;
      case 429: return ToolErrorCode.RATE_LIMIT;
      case 500: return ToolErrorCode.API_ERROR;
      case 503: return ToolErrorCode.API_ERROR;
    }
  }
  
  // Check error message
  const message = error.message || '';
  if (message.includes('not found')) return ToolErrorCode.NOT_FOUND;
  if (message.includes('permission') || message.includes('access')) return ToolErrorCode.PERMISSION_DENIED;
  if (message.includes('rate limit')) return ToolErrorCode.RATE_LIMIT;
  if (message.includes('timeout') || message.includes('timed out')) return ToolErrorCode.TIMEOUT;
  if (message.includes('network') || message.includes('connection')) return ToolErrorCode.NETWORK_ERROR;
  if (message.includes('invalid') || message.includes('validation')) return ToolErrorCode.VALIDATION_ERROR;
  
  return ToolErrorCode.UNKNOWN_ERROR;
}

/**
 * Execute a tool operation with retry logic for transient failures
 */
export async function executeToolWithRetry<T>(
  operation: () => Promise<T>,
  toolName: string,
  maxAttempts = 3
): Promise<ToolResult<T>> {
  console.log(`Executing tool ${toolName} with retry (max attempts: ${maxAttempts})`);
  
  const result = await withRetry(
    async () => {
      try {
        return await operation();
      } catch (error: any) {
        // Determine if error is transient
        if (isTransientError(error)) {
          console.log(`Transient error in tool ${toolName}, will retry:`, error);
          throw error; // Rethrow to trigger retry
        } else {
          console.error(`Non-transient error in tool ${toolName}, will not retry:`, error);
          throw error; // Rethrow but won't retry
        }
      }
    },
    {
      maxAttempts,
      initialDelay: 1000,
      backoffFactor: 2,
      retryableErrors: [
        'rate limit',
        'timeout',
        'timed out',
        'network',
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'service unavailable'
      ]
    }
  );
  
  if (!result.success) {
    const errorCode = mapErrorToToolErrorCode(result.error);
    return createToolError(
      result.error?.message || 'Unknown error',
      errorCode,
      result.error
    );
  }
  
  // We know result.result is defined if success is true
  return createToolSuccess(result.result as T);
}