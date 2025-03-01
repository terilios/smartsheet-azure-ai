import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });
console.log('DATABASE_URL:', process.env.DATABASE_URL);
import express from 'express';
import cors from 'cors';
import http from 'http';
import router from './routes.js';
import jobsRouter from './routes/jobs.js';
import webhookRouter from './routes/webhooks.js';
import sessionsRouter from './routes/sessions.js';
import smartsheetRouter from './routes/smartsheet.js';
import messagesRouter from './routes/messages.js';
import { jobQueue } from './jobs/queue.js';
// Use the original WebSocket service for now until we fully migrate to the new one
import { WebSocketService } from './services/websocket.js';
import { serverEventBus, ServerEventType } from './services/events.js';
import { sheetDataService } from './services/sheet-data.js';
import bodyParser from 'body-parser';
import { checkDatabaseConnection, pool } from './db';

// Verify environment variables
if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
  throw new Error('SMARTSHEET_ACCESS_TOKEN environment variable must be set');
}

if (!process.env.SMARTSHEET_WEBHOOK_SECRET) {
  throw new Error('SMARTSHEET_WEBHOOK_SECRET environment variable must be set');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable must be set');
}

// Initialize Smartsheet client
import { setAccessToken } from './tools/smartsheet.js';
serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
  message: 'Initializing Smartsheet client...',
  timestamp: new Date().toISOString()
});

try {
  setAccessToken(process.env.SMARTSHEET_ACCESS_TOKEN);
  serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
    message: 'Smartsheet client initialized successfully',
    timestamp: new Date().toISOString()
  });
} catch (error) {
  serverEventBus.publish(ServerEventType.SYSTEM_ERROR, {
    message: 'Failed to initialize Smartsheet client',
    error: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString()
  });
  throw error;
}

// Check database connection and run migrations
await checkDatabaseConnection();

// Run database migrations
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

console.log('Running database migrations...');
try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Database migrations completed successfully');
} catch (error) {
  console.error('Error running migrations:', error);
  throw error;
}

const app = express();
const server = http.createServer(app);

// Initialize event system
serverEventBus.setDebug(process.env.NODE_ENV === 'development');
serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
  message: 'Server starting up',
  timestamp: new Date().toISOString()
});

// Set up event logging
serverEventBus.subscribeToAll((event) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[EVENT] ${event.type}`, {
      timestamp: new Date(event.timestamp).toISOString(),
      source: event.source || 'unknown'
    });
  }
});

// Initialize WebSocket service
const wsService = WebSocketService.initialize(server);
serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
  message: 'WebSocket service initialized',
  timestamp: new Date().toISOString()
});

// Enable CORS for development
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));

// Raw body parsing for webhook signature verification
app.use(bodyParser.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/json') {
    req.rawBody = req.body; // Store raw body for webhook verification
    if (!req.rawBody) {
      return res.status(400).json({ error: 'Missing request body' });
    }
    try {
      req.body = JSON.parse(req.rawBody.toString('utf8'));
    } catch (error) {
      console.error('Error parsing JSON body:', error);
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  next();
});

// Regular JSON parsing for other routes
app.use(express.json());

// Mount routers with /api prefix
app.use('/api', router);
app.use('/api/jobs', jobsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/smartsheet', smartsheetRouter);
app.use('/api/messages', messagesRouter);
app.use('/webhooks', webhookRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
server.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
  console.log(`WebSocket server running on ws://0.0.0.0:${port}`);
});

// Start periodic cleanup of old jobs
setInterval(() => {
  jobQueue.cleanupOldJobs().catch(console.error);
}, 24 * 60 * 60 * 1000); // Run daily

// Handle server shutdown
const cleanup = async () => {
  serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
    message: 'Server shutting down',
    timestamp: new Date().toISOString()
  });
  
  // Close HTTP server
  await new Promise<void>((resolve) => {
    server.close(() => {
      serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
        message: 'HTTP server closed',
        timestamp: new Date().toISOString()
      });
      resolve();
    });
  });
  
  // Close WebSocket server
  await wsService.close();
  serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
    message: 'WebSocket server closed',
    timestamp: new Date().toISOString()
  });
  
  // Stop all sheet data refreshes
  sheetDataService.stopAllRefreshes();
  serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
    message: 'Sheet data refreshes stopped',
    timestamp: new Date().toISOString()
  });
  
  // Close database connection
  try {
    await pool.end();
    serverEventBus.publish(ServerEventType.SYSTEM_INFO, {
      message: 'Database connection closed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    serverEventBus.publish(ServerEventType.SYSTEM_ERROR, {
      message: 'Error closing database connection',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
  
  // Allow time for final cleanup and event processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
