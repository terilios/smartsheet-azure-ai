import { messages, smartsheetConfig, type Message, type InsertMessage, type SmartsheetConfig, type InsertSmartsheetConfig } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getSmartsheetConfig(): Promise<SmartsheetConfig | undefined>;
  setSmartsheetConfig(config: InsertSmartsheetConfig): Promise<SmartsheetConfig>;
}

export class DatabaseStorage implements IStorage {
  async getMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(messages.timestamp);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getSmartsheetConfig(): Promise<SmartsheetConfig | undefined> {
    const [config] = await db.select().from(smartsheetConfig).limit(1);
    return config;
  }

  async setSmartsheetConfig(config: InsertSmartsheetConfig): Promise<SmartsheetConfig> {
    // Delete existing config if any
    await db.delete(smartsheetConfig);
    // Insert new config
    const [newConfig] = await db.insert(smartsheetConfig).values(config).returning();
    return newConfig;
  }
}

export const storage = new DatabaseStorage();