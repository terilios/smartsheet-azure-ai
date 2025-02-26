import { type Message, type ChatSession } from "../shared/schema";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { messages } from "../migrations/0000_initial";
import { updatedSessions as chatSessions } from "../migrations/0001_add_users";

export const storage = {
  createSession: async (userId: string, sheetId: string): Promise<string> => {
    const sessionId = uuidv4();
    await db.insert(chatSessions).values({
      id: sessionId,
      userId,
      sheetId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return sessionId;
  },

  getSessionsByUser: async (userId: string): Promise<ChatSession[]> => {
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(chatSessions.updatedAt);

    return Promise.all(sessions.map(async (session) => {
      const sessionMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, session.id))
        .orderBy(messages.timestamp);

      return {
        id: session.id,
        userId: session.userId,
        sheetId: session.sheetId,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: sessionMessages.map(msg => ({
          role: msg.role as Message["role"],
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
          metadata: msg.metadata as Message["metadata"]
        }))
      };
    }));
  },

  getSession: async (sessionId: string): Promise<ChatSession | null> => {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));

    if (!session) return null;

    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.timestamp);

    return {
      id: session.id,
      userId: session.userId,
      sheetId: session.sheetId,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: sessionMessages.map(msg => ({
        role: msg.role as Message["role"],
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        metadata: msg.metadata as Message["metadata"]
      }))
    };
  },

  addMessage: async (sessionId: string, message: Message): Promise<void> => {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));

    if (!session) {
      throw new Error("Chat session not found");
    }

    // Get timestamp from metadata or create a new one
    const timestamp = message.metadata?.timestamp
      ? new Date(message.metadata.timestamp)
      : new Date();

    await db.insert(messages).values({
      id: uuidv4(),
      sessionId,
      role: message.role || 'user',
      content: message.content,
      timestamp,
      metadata: message.metadata || null
    });

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  },

  getMessages: async (sessionId: string): Promise<Message[]> => {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));

    if (!session) {
      throw new Error("Chat session not found");
    }

    const sessionMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(messages.timestamp);

    return sessionMessages.map(msg => ({
      role: msg.role as Message["role"],
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
      metadata: msg.metadata as Message["metadata"]
    }));
  },

  clearMessages: async (sessionId: string): Promise<void> => {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));

    if (!session) {
      throw new Error("Chat session not found");
    }

    await db
      .delete(messages)
      .where(eq(messages.sessionId, sessionId));

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    // Messages will be automatically deleted due to ON DELETE CASCADE
    await db
      .delete(chatSessions)
      .where(eq(chatSessions.id, sessionId));
  }
};
