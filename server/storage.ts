import { DEFAULT_USER_ID } from "../migrations/0001_add_users";
import { v4 as uuidv4 } from "uuid";

// In-memory storages for sessions and messages.
// In a production environment, replace these with actual database operations.
const sessions = new Map<string, any>();
const messages = new Map<string, any[]>();

export const storage = {
  /**
   * Creates a new chat session.
   * Uses the provided userId, or falls back to the DEFAULT_USER_ID if missing.
   */
  async createSession(userId: string, sheetId: string, state: string): Promise<string> {
    // Ensure a valid user ID by falling back to the default user if necessary.
    const validUserId = userId || DEFAULT_USER_ID;
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      userId: validUserId,
      sheetId,
      state,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };
    sessions.set(sessionId, session);
    // Initialize messages array for this session.
    messages.set(sessionId, []);
    return sessionId;
  },
  /**
   * Retrieves a session by its ID.
   */
  async getSession(sessionId: string) {
    return sessions.get(sessionId);
  },
  /**
   * Updates the state of an existing session.
   */
  async updateSessionState(sessionId: string, state: string, errorMessage?: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (session) {
      session.state = state;
      session.error = errorMessage || null;
      session.updatedAt = new Date();
    }
  },
  /**
   * Retrieves all sessions for a given user.
   */
  async getSessionsByUser(userId: string) {
    return Array.from(sessions.values()).filter(session => session.userId === userId);
  },
  /**
   * Retrieves all messages for the given session.
   */
  async getMessages(sessionId: string): Promise<any[]> {
    return messages.get(sessionId) || [];
  },
  /**
   * Adds a message to the given session.
   */
  async addMessage(sessionId: string, message: any): Promise<void> {
    const msgArr = messages.get(sessionId) || [];
    msgArr.push(message);
    messages.set(sessionId, msgArr);
  },
  /**
   * Updates session metadata by merging existing metadata with new entries.
   */
  async updateSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    const session = sessions.get(sessionId);
    if (session) {
      session.metadata = { ...session.metadata, ...metadata };
      session.updatedAt = new Date();
    }
  },
  /**
   * Clears all messages for the given session.
   */
  async clearMessages(sessionId: string): Promise<void> {
    messages.set(sessionId, []);
  }
};
