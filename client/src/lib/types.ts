export interface ApiErrorResponse {
  error: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export interface SheetError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}
