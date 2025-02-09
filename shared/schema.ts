import { z } from "zod";

export const MessageRole = z.enum(["user", "assistant", "function", "system"]);
export type MessageRole = z.infer<typeof MessageRole>;

// Enhanced column metadata
export const ColumnMetadata = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  index: z.number(),
  isEditable: z.boolean(),
  options: z.array(z.string()).optional(),
  systemColumn: z.boolean(),
  description: z.string().optional()
});

// Session management
export const ChatSession = z.object({
  id: z.string(),
  sheetId: z.string(),
  created: z.string(),
  lastMessage: z.string(),
  sheetName: z.string()
});

// Sheet metadata for LLM context
export const SheetMetadata = z.object({
  sheetId: z.string(),
  sheetName: z.string(),
  totalRows: z.number(),
  columns: z.array(ColumnMetadata),
  sampleData: z.array(z.record(z.any())).length(3),
  lastAccessed: z.string()
});

// Message metadata with session context
export const MessageMetadata = z.object({
  sessionId: z.string().optional(),
  sheetId: z.string().optional(),
  operation: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string()
}).nullable();

// Full sheet data for viewer
export const SheetData = z.object({
  columns: z.array(ColumnMetadata),
  rows: z.array(z.record(z.any())),
  sheetName: z.string(),
  totalRows: z.number(),
  lastUpdated: z.string(),
  sessionId: z.string().optional()
});

// Job status and progress tracking
export const JobProgress = z.object({
  processed: z.number(),
  total: z.number(),
  failed: z.number()
});

export const JobStatus = z.object({
  id: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  progress: JobProgress,
  error: z.string().optional(),
  created: z.date(),
  updated: z.date(),
  completed: z.date().optional()
});

// Bulk operation types
export const BulkOperationType = z.enum([
  'SUMMARIZE',
  'SCORE_ALIGNMENT',
  'EXTRACT_TERMS'
]);

export const BulkOperation = z.object({
  sheetId: z.string(),
  sourceColumns: z.array(z.string()),
  targetColumn: z.string(),
  operation: z.object({
    type: BulkOperationType,
    parameters: z.record(z.any()).optional()
  })
});

// API responses
export const SheetResponse = z.object({
  success: z.boolean(),
  data: SheetData.optional(),
  error: z.string().optional()
});

export const JobResponse = z.object({
  success: z.boolean(),
  jobId: z.string().optional(),
  status: JobStatus.optional(),
  error: z.string().optional(),
  message: z.string().optional()
});

export const FunctionCall = z.object({
  id: z.string()
});

export const Message = z.object({
  id: z.number().optional(),
  content: z.string(),
  role: MessageRole,
  timestamp: z.string().or(z.date()),
  metadata: MessageMetadata,
  name: z.string().optional(),
  function_call: FunctionCall.optional()
});

// Type exports
export type ColumnMetadata = z.infer<typeof ColumnMetadata>;
export type ChatSession = z.infer<typeof ChatSession>;
export type SheetMetadata = z.infer<typeof SheetMetadata>;
export type SheetData = z.infer<typeof SheetData>;
export type SheetResponse = z.infer<typeof SheetResponse>;
export type Message = z.infer<typeof Message>;
export type JobStatus = z.infer<typeof JobStatus>;
export type JobProgress = z.infer<typeof JobProgress>;
export type JobResponse = z.infer<typeof JobResponse>;
export type BulkOperationType = z.infer<typeof BulkOperationType>;
export type BulkOperation = z.infer<typeof BulkOperation>;
