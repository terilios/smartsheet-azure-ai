import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { updatedSessions as chatSessions } from "./0001_add_users";

/**
 * Add metadata column to chat_sessions table
 */
export const updatedSessionsWithMetadata = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => chatSessions.userId),
  sheetId: text("sheet_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  metadata: jsonb("metadata")
});