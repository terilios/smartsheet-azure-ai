import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import OpenAI from 'openai';
import smartsheet from 'smartsheet';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Types
export interface ProcessingTask {
  sheetId: string;
  sourceColumns: string[];
  targetColumn: string;
  generatedPrompt: string;
  outputSchema: any;
}

export interface ProcessingJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    processed: number;
    total: number;
    failed: number;
  };
  task: ProcessingTask;
  error?: string;
  created: Date;
  updated: Date;
  completed?: Date;
}

interface JobUpdate {
  status?: ProcessingJob['status'];
  progress?: Partial<ProcessingJob['progress']>;
  error?: string;
  completed?: Date;
}

export class JobQueue extends EventEmitter {
  private jobs: Map<string, ProcessingJob>;
  private openai: OpenAI;
  private smartsheetClient: any;
  private readonly BATCH_SIZE = 25;
  private readonly JOB_DIR = path.join(os.homedir(), '.smartsheet_jobs');
  private readonly JOB_FILE = path.join(this.JOB_DIR, 'jobs.json');
  private activeWorkers: Map<string, AbortController>;

  constructor(openaiApiKey: string, smartsheetToken: string) {
    super();
    this.jobs = new Map();
    this.activeWorkers = new Map();
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: openaiApiKey,
      baseURL: process.env.AZURE_OPENAI_API_BASE ? 
        `${process.env.AZURE_OPENAI_API_BASE}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}` : 
        undefined
    });

    // Initialize Smartsheet client
    this.smartsheetClient = smartsheet.createClient({
      accessToken: smartsheetToken,
      logLevel: 'info'
    });

    // Initialize job storage
    this.initializeStorage().catch(error => {
      console.error('Failed to initialize job storage:', error);
    });
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Create job directory if it doesn't exist
      await fs.mkdir(this.JOB_DIR, { recursive: true });

      // Load existing jobs
      try {
        const data = await fs.readFile(this.JOB_FILE, 'utf-8');
        const jobs = JSON.parse(data);
        this.jobs = new Map(Object.entries(jobs));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, start with empty job map
        await this.saveJobs();
      }

      // Recover interrupted jobs
      await this.recoverInterruptedJobs();
    } catch (error) {
      console.error('Error initializing storage:', error);
      throw error;
    }
  }

  private async saveJobs(): Promise<void> {
    try {
      const jobsObject = Object.fromEntries(this.jobs);
      await fs.writeFile(this.JOB_FILE, JSON.stringify(jobsObject, null, 2));
    } catch (error) {
      console.error('Error saving jobs:', error);
      throw error;
    }
  }

  private async recoverInterruptedJobs(): Promise<void> {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'processing') {
        console.log(`Recovering interrupted job: ${jobId}`);
        await this.updateJob(jobId, {
          status: 'failed',
          error: 'Job interrupted by system shutdown'
        });
      }
    }
  }

  private async updateJob(jobId: string, update: JobUpdate): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (update.status) job.status = update.status;
    if (update.progress) {
      job.progress = { ...job.progress, ...update.progress };
    }
    if (update.error) job.error = update.error;
    if (update.completed) job.completed = update.completed;

    job.updated = new Date();

    await this.saveJobs();
    this.emit(`job:${jobId}`, job);
    this.emit('job:updated', job);
  }

  async createJob(task: ProcessingTask): Promise<string> {
    const jobId = uuidv4();
    const job: ProcessingJob = {
      id: jobId,
      status: 'queued',
      progress: {
        processed: 0,
        total: 0,
        failed: 0
      },
      task,
      created: new Date(),
      updated: new Date()
    };

    this.jobs.set(jobId, job);
    await this.saveJobs();

    // Start processing in background
    this.processJob(jobId).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      this.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });

    return jobId;
  }

  async getStatus(jobId: string): Promise<ProcessingJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async cancelJob(jobId: string): Promise<void> {
    const controller = this.activeWorkers.get(jobId);
    if (controller) {
      controller.abort();
      this.activeWorkers.delete(jobId);
    }

    await this.updateJob(jobId, {
      status: 'failed',
      error: 'Job cancelled by user'
    });
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    try {
      // Create abort controller for this job
      const controller = new AbortController();
      this.activeWorkers.set(jobId, controller);

      await this.updateJob(jobId, { status: 'processing' });

      // Get sheet to determine total rows
      const sheet = await this.smartsheetClient.sheets.getSheet({
        id: job.task.sheetId
      });

      await this.updateJob(jobId, {
        progress: { total: sheet.rows.length }
      });

      // Process in batches
      for (let offset = 0; offset < sheet.rows.length; offset += this.BATCH_SIZE) {
        // Check if job was cancelled
        if (controller.signal.aborted) {
          throw new Error('Job cancelled');
        }

        const batch = sheet.rows.slice(offset, offset + this.BATCH_SIZE);
        await this.processBatch(batch, job);

        await this.updateJob(jobId, {
          progress: { processed: offset + batch.length }
        });
      }

      await this.updateJob(jobId, {
        status: 'completed',
        completed: new Date()
      });
    } catch (error) {
      await this.updateJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      this.activeWorkers.delete(jobId);
    }
  }

  private async processBatch(rows: any[], job: ProcessingJob): Promise<void> {
    const updates = await Promise.all(
      rows.map(async row => {
        try {
          const content = this.extractContent(row, job.task.sourceColumns);
          const result = await this.processWithGPT4o(content, job.task);
          
          return {
            id: row.id,
            cells: [{
              columnId: job.task.targetColumn,
              value: this.extractValue(result, job.task)
            }]
          };
        } catch (error) {
          console.error(`Error processing row ${row.id}:`, error);
          await this.updateJob(job.id, {
            progress: { failed: (job.progress.failed || 0) + 1 }
          });
          return null;
        }
      })
    );

    // Filter out failed rows and update Smartsheet
    const validUpdates = updates.filter((update): update is NonNullable<typeof update> => update !== null);
    if (validUpdates.length > 0) {
      await this.smartsheetClient.sheets.updateRows({
        sheetId: job.task.sheetId,
        body: validUpdates
      });
    }
  }

  private extractContent(row: any, sourceColumns: string[]): string {
    return sourceColumns
      .map(colId => {
        const cell = row.cells.find((c: any) => c.columnId === colId);
        return cell?.value || '';
      })
      .join(' ');
  }

  private async processWithGPT4o(content: string, task: ProcessingTask): Promise<any> {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: task.generatedPrompt.replace('{content}', content)
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content || '{}');
  }

  private extractValue(result: any, task: ProcessingTask): any {
    const schema = task.outputSchema;
    const requiredField = schema.required[0];
    
    if (!result[requiredField]) {
      throw new Error(`Missing required field: ${requiredField}`);
    }

    return result[requiredField];
  }

  // Cleanup old jobs periodically
  async cleanupOldJobs(maxAgeDays: number = 7): Promise<void> {
    const now = new Date();
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        const ageInDays = (now.getTime() - job.updated.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > maxAgeDays) {
          this.jobs.delete(jobId);
        }
      }
    }
    await this.saveJobs();
  }
}

// Export singleton instance
export const jobQueue = new JobQueue(
  process.env.OPENAI_API_KEY || '',
  process.env.SMARTSHEET_ACCESS_TOKEN || ''
);
