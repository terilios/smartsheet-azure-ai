import { z } from "zod";

// Column Types
export const columnTypeSchema = z.enum([
  "TEXT_NUMBER",
  "DATE",
  "CHECKBOX",
  "PICKLIST",
  "CONTACT_LIST",
  "TEXT",
  "NUMBER",
  "SYSTEM"
]);

export type ColumnType = z.infer<typeof columnTypeSchema>;

// Column Metadata
export const columnMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: columnTypeSchema,
  isEditable: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  description: z.string().optional(),
  systemColumn: z.boolean().optional(),
});

export type ColumnMetadata = z.infer<typeof columnMetadataSchema>;

// Sheet Data
export const sheetDataSchema = z.object({
  sheetId: z.string(),
  sheetName: z.string(),
  columns: z.array(columnMetadataSchema),
  rows: z.array(z.record(z.string(), z.any())),
  totalRows: z.number(),
  lastUpdated: z.string().optional(),
});

export type SheetData = z.infer<typeof sheetDataSchema>;

// Message Types
export const messageTypeSchema = z.enum([
  "USER",
  "ASSISTANT",
  "SYSTEM",
  "ERROR"
]);

export type MessageType = z.infer<typeof messageTypeSchema>;

// Message Role
export const messageRoleSchema = z.enum([
  "user",
  "assistant",
  "system",
  "error",
  "function"
]);

export type MessageRole = z.infer<typeof messageRoleSchema>;

// Message Status
export const messageStatusSchema = z.enum([
  "pending",
  "complete",
  "error",
  "success"
]);

export type MessageStatus = z.infer<typeof messageStatusSchema>;

// Base Message Metadata
export const baseMessageMetadataSchema = z.object({
  id: z.string(),
  type: messageTypeSchema,
  timestamp: z.string(),
  sessionId: z.string().nullable().optional(),
  role: messageRoleSchema.optional(),
  error: z.unknown().optional(),
  operation: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  status: messageStatusSchema.optional(),
});

// Operation Message Metadata
export const operationMessageMetadataSchema = z.object({
  type: messageTypeSchema.default("SYSTEM"),
  id: z.string().default(() => crypto.randomUUID()),
  timestamp: z.string(),
  operation: z.string().nullable().optional(),
  status: messageStatusSchema,
  error: z.string().optional(),
  sessionId: z.string().optional(),
  name: z.string().nullable().optional(),
  role: messageRoleSchema.optional(),
});

export type MessageMetadata = z.infer<typeof baseMessageMetadataSchema>;
export type OperationMessageMetadata = z.infer<typeof operationMessageMetadataSchema>;

// Chat Message
export const chatMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// Message
export const messageSchema = z.object({
  metadata: baseMessageMetadataSchema,
  content: z.string(),
  role: messageRoleSchema.optional(),
  name: z.string().optional(),
});

export type Message = z.infer<typeof messageSchema>;

// Operation Message
export const operationMessageSchema = z.object({
  metadata: operationMessageMetadataSchema,
  content: z.string().optional(),
});

export type OperationMessage = z.infer<typeof operationMessageSchema>;

// API Error Response
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  statusCode: z.number().optional(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// API Success Response
export const apiSuccessSchema = z.object({
  message: z.string().optional(),
  data: z.unknown(),
});

export type ApiSuccess = z.infer<typeof apiSuccessSchema>;

// Smartsheet Configuration
export const smartsheetConfigSchema = z.object({
  sheetId: z.string(),
  accessToken: z.string(),
});

export const insertSmartsheetConfigSchema = smartsheetConfigSchema;

export type SmartsheetConfig = z.infer<typeof smartsheetConfigSchema>;

// Smartsheet Configuration Response
export const smartsheetConfigResponseSchema = z.object({
  message: z.string(),
  config: smartsheetConfigSchema,
});

export type SmartsheetConfigResponse = z.infer<typeof smartsheetConfigResponseSchema>;

// Bulk Operation Types
export const bulkOperationTypeSchema = z.enum([
  "UPDATE",
  "DELETE",
  "INSERT"
]);

export type BulkOperationType = z.infer<typeof bulkOperationTypeSchema>;

// Bulk Operation Request
export const bulkOperationRequestSchema = z.object({
  type: bulkOperationTypeSchema,
  sheetId: z.string(),
  data: z.array(z.record(z.string(), z.any())),
});

export type BulkOperationRequest = z.infer<typeof bulkOperationRequestSchema>;

// Bulk Operation Response
export const bulkOperationResponseSchema = z.object({
  message: z.string(),
  rowsAffected: z.number(),
});

export type BulkOperationResponse = z.infer<typeof bulkOperationResponseSchema>;

// Column Type Mapping
export const columnTypeMapping: Record<string, ColumnType> = {
  "TEXT_NUMBER": "TEXT_NUMBER",
  "DATE": "DATE",
  "CHECKBOX": "CHECKBOX",
  "PICKLIST": "PICKLIST",
  "CONTACT_LIST": "CONTACT_LIST",
  "TEXT": "TEXT",
  "NUMBER": "NUMBER",
  "SYSTEM": "SYSTEM"
} as const;
