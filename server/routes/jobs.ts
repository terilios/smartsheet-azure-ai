import { Router } from 'express';
import { jobQueue } from '../jobs/queue';
import { z } from 'zod';
import { WebSocketServer } from 'ws';
import http from 'http';

const router = Router();

// Schema for job creation request
const CreateJobSchema = z.object({
  sheetId: z.string(),
  sourceColumns: z.array(z.string()),
  targetColumn: z.string(),
  operation: z.object({
    type: z.enum(["SUMMARIZE", "SCORE_ALIGNMENT", "EXTRACT_TERMS"]),
    parameters: z.record(z.any()).optional()
  })
});

// WebSocket setup for real-time updates
export function setupWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'subscribe' && data.jobId) {
          // Subscribe to job updates
          const jobId = data.jobId;
          
          // Send initial status
          jobQueue.getStatus(jobId).then(status => {
            if (status) {
              ws.send(JSON.stringify({ type: 'status', jobId, status }));
            }
          });
          
          // Listen for updates
          const updateHandler = (status: any) => {
            ws.send(JSON.stringify({ type: 'status', jobId, status }));
          };
          
          jobQueue.on(`job:${jobId}`, updateHandler);
          
          // Cleanup on close
          ws.on('close', () => {
            jobQueue.removeListener(`job:${jobId}`, updateHandler);
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
  });
  
  return wss;
}

// Create a new processing job
router.post('/api/jobs', async (req, res) => {
  try {
    const validatedData = CreateJobSchema.parse(req.body);
    
    // Generate the appropriate prompt based on operation type
    let prompt = '';
    let outputSchema = {};
    
    switch (validatedData.operation.type) {
      case 'SUMMARIZE':
        prompt = `Analyze and summarize the following content:
Content from columns: ${validatedData.sourceColumns.join(', ')}
{content}

Provide a concise summary that captures the key points.`;
        outputSchema = {
          type: 'object',
          required: ['summary'],
          properties: {
            summary: {
              type: 'string',
              maxLength: 500
            }
          }
        };
        break;
        
      case 'SCORE_ALIGNMENT':
        prompt = `Analyze the following content and score its alignment with Boston Children's Hospital's mission:
Content from columns: ${validatedData.sourceColumns.join(', ')}
{content}

Consider:
- Pediatric healthcare focus
- Innovation and research
- Patient-centered care
- Family-centered approach

Provide a score from 1-100 based on alignment.`;
        outputSchema = {
          type: 'object',
          required: ['score'],
          properties: {
            score: {
              type: 'number',
              minimum: 1,
              maximum: 100
            }
          }
        };
        break;
        
      case 'EXTRACT_TERMS':
        prompt = `Extract key terms from the following content:
Content from columns: ${validatedData.sourceColumns.join(', ')}
{content}

Identify and list the most important terms, focusing on medical terminology, technical concepts, and significant phrases.`;
        outputSchema = {
          type: 'object',
          required: ['terms'],
          properties: {
            terms: {
              type: 'array',
              items: {
                type: 'string'
              },
              maxItems: 7
            }
          }
        };
        break;
    }

    const jobId = await jobQueue.createJob({
      sheetId: validatedData.sheetId,
      sourceColumns: validatedData.sourceColumns,
      targetColumn: validatedData.targetColumn,
      generatedPrompt: prompt,
      outputSchema
    });

    // Start periodic cleanup of old jobs
    setInterval(() => {
      jobQueue.cleanupOldJobs().catch(console.error);
    }, 24 * 60 * 60 * 1000); // Run daily

    res.json({
      success: true,
      jobId,
      message: 'Processing started. You can check status using the job ID.'
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create job'
    });
  }
});

// Get job status
router.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await jobQueue.getStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status'
    });
  }
});

// Cancel a job
router.post('/api/jobs/:jobId/cancel', async (req, res) => {
  try {
    const { jobId } = req.params;
    await jobQueue.cancelJob(jobId);
    
    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job'
    });
  }
});

export { router as jobsRouter };
