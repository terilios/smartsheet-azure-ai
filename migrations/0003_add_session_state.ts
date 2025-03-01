import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { updatedSessionsWithMetadata as chatSessions } from "./0002_add_session_metadata";

/**
 * Add state and error columns to chat_sessions table
 */
export const updatedSessionsWithState = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => chatSessions.userId),
  sheetId: text("sheet_id").notNull(),
  state: text("state").notNull().default("INITIALIZING"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  metadata: jsonb("metadata")
});