import { pgTable, text, serial, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: json("metadata")
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  role: true,
  metadata: true
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const smartsheetConfig = pgTable("smartsheet_config", {
  id: serial("id").primaryKey(),
  sheetId: text("sheet_id").notNull(),
  accessToken: text("access_token").notNull()
});

export const insertSmartsheetConfigSchema = createInsertSchema(smartsheetConfig).pick({
  sheetId: true,
  accessToken: true
});

export type SmartsheetConfig = typeof smartsheetConfig.$inferSelect;
export type InsertSmartsheetConfig = z.infer<typeof insertSmartsheetConfigSchema>;
