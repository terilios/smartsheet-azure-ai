import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import express from 'express';
import request from 'supertest';
import router from './routes';
import { storage } from './storage';

describe('Chat API Routes', () => {
  let app: express.Application;
  let pool: Pool;

  beforeAll(async () => {
    // Set up test database connection
    const TEST_DB_URL = process.env.TEST_DATABASE_URL;
    if (!TEST_DB_URL) {
      throw new Error('TEST_DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: TEST_DB_URL,
    });

    const db = drizzle(pool);

    // Run migrations
    await migrate(db, { migrationsFolder: './migrations' });

    // Set up Express app
    app = express();
    app.use(express.json());
    app.use(router);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    const sessions = await storage.getSession('test-session');
    if (sessions) {
      await storage.deleteSession('test-session');
    }
  });

  describe('Chat Session Management', () => {
    test('should create a new chat session', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ sheetId: 'test-sheet' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sessionId).toBeDefined();
    });

    test('should require sheetId when creating chat session', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('sheetId is required');
    });
  });

  describe('Message Management', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Create a test chat session
      sessionId = await storage.createSession('test-sheet');
    });

    test('should send and receive messages', async () => {
      // Send a message
      const sendRes = await request(app)
        .post('/api/messages')
        .send({
          content: 'Test message',
          metadata: {
            sessionId,
            sheetId: 'test-sheet',
            operation: null,
            status: null,
            timestamp: new Date().toISOString()
          }
        });

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.content).toBeDefined();

      // Get messages
      const getRes = await request(app)
        .get(`/api/messages?sessionId=${sessionId}`);

      expect(getRes.status).toBe(200);
      expect(Array.isArray(getRes.body)).toBe(true);
      expect(getRes.body.length).toBeGreaterThan(0);
      expect(getRes.body.some((msg: any) => 
        msg.content === 'Test message' && 
        msg.role === 'user'
      )).toBe(true);
    });

    test('should clear messages', async () => {
      // Add a test message
      await storage.addMessage(sessionId, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString()
      });

      // Clear messages
      const clearRes = await request(app)
        .delete(`/api/messages?sessionId=${sessionId}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.success).toBe(true);

      // Verify messages are cleared
      const getRes = await request(app)
        .get(`/api/messages?sessionId=${sessionId}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body).toHaveLength(0);
    });

    test('should handle missing sessionId', async () => {
      const res = await request(app)
        .get('/api/messages');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('sessionId is required');
    });

    test('should handle non-existent chat session', async () => {
      const res = await request(app)
        .get('/api/messages?sessionId=non-existent');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Message Processing', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await storage.createSession('test-sheet');
    });

    test('should process message with OpenAI', async () => {
      const res = await request(app)
        .post('/api/messages')
        .send({
          content: "What's in this sheet?",
          metadata: {
            sessionId,
            sheetId: 'test-sheet',
            operation: null,
            status: null,
            timestamp: new Date().toISOString()
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('assistant');
      expect(res.body.content).toBeDefined();
      expect(typeof res.body.content).toBe('string');
    });

    test('should handle OpenAI errors gracefully', async () => {
      // Temporarily clear API key to force error
      const originalKey = process.env.AZURE_OPENAI_API_KEY;
      process.env.AZURE_OPENAI_API_KEY = '';

      const res = await request(app)
        .post('/api/messages')
        .send({
          content: "What's in this sheet?",
          metadata: {
            sessionId,
            sheetId: 'test-sheet',
            operation: null,
            status: null,
            timestamp: new Date().toISOString()
          }
        });

      // Restore API key
      process.env.AZURE_OPENAI_API_KEY = originalKey;

      expect(res.status).toBe(500);
      expect(res.body.role).toBe('assistant');
      expect(res.body.metadata.status).toBe('error');
    });

    test('should require message content', async () => {
      const res = await request(app)
        .post('/api/messages')
        .send({
          content: '',
          metadata: {
            sessionId,
            sheetId: 'test-sheet',
            operation: null,
            status: null,
            timestamp: new Date().toISOString()
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('content is required');
    });
  });
});
