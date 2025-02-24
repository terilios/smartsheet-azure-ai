import { Queue, Job, JobsOptions } from "bullmq";
import { type OperationMessage } from "@shared/schema";
import Redis from "ioredis";

const connection = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
});
// Listen for connection errors to give a clearer message when Redis is not running.
connection.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export interface JobData {
  type: string;
  params: Record<string, any>;
}

export interface JobResult extends OperationMessage {}

// Match BullMQ's actual job states
export type JobState = "active" | "completed" | "failed" | "delayed" | "wait" | "paused";

// BullMQ job types and statuses
type JobType = JobData["type"];
type JobStatus = "active" | "waiting" | "delayed" | "completed" | "failed";
type CleanableState = Extract<JobStatus, "completed" | "failed">;

class JobQueue {
  private queue: Queue<JobData, JobResult>;

  constructor() {
    this.queue = new Queue<JobData, JobResult>("jobs", {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async add(name: string, data: JobData, opts?: JobsOptions): Promise<Job<JobData, JobResult>> {
    return this.queue.add(name, data, opts);
  }

  async getJob(jobId: string): Promise<Job<JobData, JobResult> | undefined> {
    return this.queue.getJob(jobId);
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  private getJobStatus(state: JobState): JobStatus {
    switch (state) {
      case "active":
        return "active";
      case "wait":
        return "waiting";
      case "delayed":
        return "delayed";
      case "completed":
        return "completed";
      case "failed":
        return "failed";
      case "paused":
        return "waiting"; // Paused jobs are in waiting state
      default:
        return "waiting";
    }
  }

  private async getJobsByState(state: JobState): Promise<Job<JobData, JobResult>[]> {
    try {
      const status = this.getJobStatus(state);
      let jobs: Job<JobData, JobResult>[] = [];
      const start = 0;
      const end = 99;
      switch (status) {
        case "active":
          jobs = await this.queue.getActive(start, end);
          break;
        case "waiting":
          jobs = await this.queue.getWaiting(start, end);
          break;
        case "delayed":
          jobs = await this.queue.getDelayed(start, end);
          break;
        case "completed":
          jobs = await this.queue.getCompleted(start, end);
          break;
        case "failed":
          jobs = await this.queue.getFailed(start, end);
          break;
      }
      if (state === "paused" && !(await this.queue.isPaused())) {
        return [];
      }
      return jobs || [];
    } catch (error) {
      console.error(`Error getting jobs for state ${state}:`, error);
      return [];
    }
  }

  async getJobs(states: JobState[]): Promise<Job<JobData, JobResult>[]> {
    const jobs: Job<JobData, JobResult>[] = [];
    for (const state of states) {
      const stateJobs = await this.getJobsByState(state);
      jobs.push(...stateJobs);
    }
    return jobs;
  }

  async clean(grace: number, _limit: number, state?: JobState): Promise<number> {
    const graceMs = grace * 1000;
    let cleanedCount = 0;
    try {
      if (state === "completed" || state === "failed") {
        const cleanState: CleanableState = state;
        await this.queue.clean(graceMs, 1000, cleanState);
        cleanedCount = 1;
      } else {
        const states: CleanableState[] = ["completed", "failed"];
        for (const cleanState of states) {
          await this.queue.clean(graceMs, 1000, cleanState);
          cleanedCount += 1;
        }
      }
    } catch (error) {
      console.error('Error cleaning jobs:', error);
      cleanedCount = 0;
    }
    return cleanedCount;
  }
  
  async cleanupOldJobs(): Promise<void> {
    try {
      // Use a grace period of 24 hours (86400 seconds)
      await this.clean(86400, 1000);
    } catch (error) {
      console.error('Error during cleanupOldJobs:', error);
    }
  }

  async pause(): Promise<void> {
    await this.queue.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  async getJobCounts(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0,
    };
  }
}

export const jobQueue = new JobQueue();
