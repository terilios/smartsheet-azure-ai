import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

export const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Users table for storing user information
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

/**
 * Update sessions table to reference users
 * 
 * Note: This doesn't actually modify the existing sessions table.
 * It's a redefinition that will be used in code going forward.
 * The actual migration is handled in the SQL file.
 */
export const updatedSessions = pgTable("chat_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  sheetId: text("sheet_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
}, (table) => {
  return {
    userIdIdx: index("idx_chat_sessions_user_id").on(table.userId)
  };
});
