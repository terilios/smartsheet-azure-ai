import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { storage } from './storage';
import { v4 as uuidv4 } from 'uuid';

describe('Database Operations', () => {
  let pool: Pool;

  beforeAll(async () => {
    // Use a test database
    const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
    if (!TEST_DB_URL) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: TEST_DB_URL,
    });

    const db = drizzle(pool);

    // Run migrations to ensure schema is up to date
    await migrate(db, { migrationsFolder: './migrations' });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Session Management', () => {
    test('should create and retrieve a session', async () => {
      const sheetId = uuidv4();
      const sessionId = await storage.createSession(sheetId);

      const session = await storage.getSession(sessionId);
      expect(session).toBeTruthy();
      expect(session?.sheetId).toBe(sheetId);
      expect(session?.messages).toHaveLength(0);
    });

    test('should return null for non-existent session', async () => {
      const nonExistentId = uuidv4();
      const session = await storage.getSession(nonExistentId);
      expect(session).toBeNull();
    });

    test('should delete session and its messages', async () => {
      const sheetId = uuidv4();
      const sessionId = await storage.createSession(sheetId);

      // Add a test message
      await storage.addMessage(sessionId, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString()
      });

      // Verify message was added
      let messages = await storage.getMessages(sessionId);
      expect(messages).toHaveLength(1);

      // Delete session
      await storage.deleteSession(sessionId);

      // Verify session and messages are gone
      const session = await storage.getSession(sessionId);
      expect(session).toBeNull();

      // This should throw since session doesn't exist
      await expect(storage.getMessages(sessionId)).rejects.toThrow('Session not found');
    });
  });

  describe('Message Management', () => {
    test('should add and retrieve messages', async () => {
      const sheetId = uuidv4();
      const sessionId = await storage.createSession(sheetId);

      const message1 = {
        role: 'user' as const,
        content: 'Test message 1',
        timestamp: new Date().toISOString()
      };

      const message2 = {
        role: 'assistant' as const,
        content: 'Test message 2',
        timestamp: new Date().toISOString()
      };

      await storage.addMessage(sessionId, message1);
      await storage.addMessage(sessionId, message2);

      const messages = await storage.getMessages(sessionId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe(message1.content);
      expect(messages[1].content).toBe(message2.content);
    });

    test('should clear messages', async () => {
      const sheetId = uuidv4();
      const sessionId = await storage.createSession(sheetId);

      // Add test messages
      await storage.addMessage(sessionId, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString()
      });

      // Verify message was added
      let messages = await storage.getMessages(sessionId);
      expect(messages).toHaveLength(1);

      // Clear messages
      await storage.clearMessages(sessionId);

      // Verify messages are cleared
      messages = await storage.getMessages(sessionId);
      expect(messages).toHaveLength(0);

      // Session should still exist
      const session = await storage.getSession(sessionId);
      expect(session).toBeTruthy();
    });

    test('should handle message metadata', async () => {
      const sheetId = uuidv4();
      const sessionId = await storage.createSession(sheetId);

      const metadata = {
        operation: 'test',
        status: 'success' as const,
        timestamp: new Date().toISOString()
      };

      const message = {
        role: 'system' as const,
        content: 'Test message with metadata',
        timestamp: new Date().toISOString(),
        metadata
      };

      await storage.addMessage(sessionId, message);

      const messages = await storage.getMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].metadata).toEqual(metadata);
    });
  });
});
