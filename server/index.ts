import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });
console.log('DATABASE_URL:', process.env.DATABASE_URL);
import express from 'express';
import cors from 'cors';
import http from 'http';
import router from './routes.js';
import { jobsRouter } from './routes/jobs.js';
import webhookRouter from './routes/webhooks.js';
import { jobQueue } from './jobs/queue.js';
import { WebSocketService } from './services/websocket.js';
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

// Initialize WebSocket service
const wsService = new WebSocketService(server);

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

// Mount routers
app.use(router);
app.use(jobsRouter);
app.use('/webhooks', webhookRouter);

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
  console.log('Shutting down server...');
  
  // Close HTTP server
  await new Promise<void>((resolve) => {
    server.close(() => {
      console.log('HTTP server closed');
      resolve();
    });
  });
  
  // Close WebSocket server
  await wsService.close();
  
  // Close database connection
  try {
    await pool.end();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
  
  // Allow time for final cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
