import { pgTable, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  name: text('name'),
  timestamp: timestamp('timestamp').defaultNow(),
  metadata: jsonb('metadata'),
  sessionId: text('session_id').references(() => chatSessions.id),
});

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey(),
  sheetId: text('sheet_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobs = pgTable('jobs', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  progress: integer('progress').notNull().default(0),
  total: integer('total').notNull().default(0),
  error: text('error'),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// TypeScript interfaces
export interface Message {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
  timestamp?: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  sessionId?: string;
  sheetId?: string;
  operation: string | null;
  status: "success" | "error" | "pending" | null;
  error?: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  sheetId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface ColumnMetadata {
  id: string;
  title: string;
  type: string;
  index: number;
  isEditable: boolean;
  options?: string[];
  systemColumn: boolean;
  description?: string;
}

export interface SheetData {
  columns: ColumnMetadata[];
  rows: Record<string, any>[];
  sheetName: string;
  totalRows: number;
  lastUpdated: string;
  sheetId: string;
}

export interface SheetResponse {
  success: boolean;
  data?: SheetData;
  error?: string;
  message?: string;
}

export interface JobStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  total: number;
  error?: string;
  result?: any;
}

export interface BulkOperationResult {
  success: boolean;
  message: string;
  jobId?: string;
  metadata?: {
    jobId?: string;
    operation: string;
    status: "success" | "error" | "pending";
    timestamp: string;
    error?: string;
  };
}

export interface ApiError {
  error: string;
  code?: string;
  details?: any;
}
