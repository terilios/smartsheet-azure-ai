import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import router from './routes.js';
import { jobsRouter, setupWebSocket } from './routes/jobs.js';
import { jobQueue } from './jobs/queue.js';

// Verify environment variables
if (!process.env.SMARTSHEET_ACCESS_TOKEN) {
  throw new Error('SMARTSHEET_ACCESS_TOKEN environment variable must be set');
}

const app = express();
const server = http.createServer(app);

// Enable CORS for development
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Mount routers
app.use(router);
app.use(jobsRouter);

// Set up WebSocket server
const wss = setupWebSocket(server);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`WebSocket server running on ws://localhost:${port}`);
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
  await new Promise<void>((resolve) => {
    wss.close(() => {
      console.log('WebSocket server closed');
      resolve();
    });
  });
  
  // Allow time for final cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
