import { messages, smartsheetConfig, type Message, type InsertMessage, type SmartsheetConfig, type InsertSmartsheetConfig } from "@shared/schema";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getSmartsheetConfig(): Promise<SmartsheetConfig | undefined>;
  setSmartsheetConfig(config: InsertSmartsheetConfig): Promise<SmartsheetConfig>;
}

export class MemStorage implements IStorage {
  private messages: Map<number, Message>;
  private smartsheetConfig: Map<number, SmartsheetConfig>;
  private currentMessageId: number;
  private currentConfigId: number;

  constructor() {
    this.messages = new Map();
    this.smartsheetConfig = new Map();
    this.currentMessageId = 1;
    this.currentConfigId = 1;
  }

  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values());
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const timestamp = new Date();
    const newMessage: Message = {
      ...message,
      id,
      timestamp,
      metadata: message.metadata ?? null
    };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async getSmartsheetConfig(): Promise<SmartsheetConfig | undefined> {
    return Array.from(this.smartsheetConfig.values())[0];
  }

  async setSmartsheetConfig(config: InsertSmartsheetConfig): Promise<SmartsheetConfig> {
    const id = this.currentConfigId++;
    const newConfig = { ...config, id };
    this.smartsheetConfig.set(id, newConfig);
    return newConfig;
  }
}

export const storage = new MemStorage();