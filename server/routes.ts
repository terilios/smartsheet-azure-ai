import express from "express";
import { z } from "zod";
import { jobQueue, type JobState } from "./jobs/queue";
import { type Message, type OperationMessage } from "@shared/schema";
import crypto from "crypto";
import sessionsRouter from "./routes/sessions";

const router = express.Router();

// Mount sessions router before session validation middleware
router.use("/sessions", sessionsRouter);

// Validate session ID for all other routes
router.use((req, res, next) => {
  // Skip session validation for session-related endpoints
  if (req.path.startsWith('/sessions')) {
    return next();
  }
  
  const sessionId = req.headers["x-session-id"];
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({
      error: "Missing or invalid session ID",
      code: "INVALID_SESSION"
    });
  }
  next();
});

// Create operation message helper
function createOperationMessage(
  operation: string,
  status: "pending" | "success" | "error",
  error?: string,
  sessionId?: string
): OperationMessage {
  return {
    metadata: {
      type: "SYSTEM",
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      operation: operation || undefined,
      status,
      error: error || undefined,
      sessionId: sessionId || undefined,
      name: undefined,
    },
    content: error || ""
  };
}

// Start analysis job
router.post("/analyze", async (req, res) => {
  const sessionId = req.headers["x-session-id"] as string;
  const { type, sourceColumns, targetColumn, rowIds, customGoal } = req.body;

  const job = await jobQueue.add("analyze", {
    type: "analysis",
    params: {
      type,
      sourceColumns,
      targetColumn,
      rowIds,
      customGoal,
      sessionId
    }
  });

  const response = createOperationMessage("analyze", "pending", undefined, sessionId);
  res.json(response);
});

// Cancel analysis job
router.delete("/analyze/:jobId", async (req, res) => {
  const sessionId = req.headers["x-session-id"] as string;
  const jobId = req.params.jobId;

  await jobQueue.removeJob(jobId);

  const response = createOperationMessage("analyze", "success", undefined, sessionId);
  res.json(response);
});

// Get job status
router.get("/jobs/:jobId", async (req, res) => {
  const sessionId = req.headers["x-session-id"] as string;
  const jobId = req.params.jobId;

  const job = await jobQueue.getJob(jobId);
  if (!job) {
    const response = createOperationMessage("getJob", "error", "Job not found", sessionId);
    return res.status(404).json(response);
  }

  const state = await job.getState();
  const response = createOperationMessage(
    "getJob",
    state === "completed" ? "success" : state === "failed" ? "error" : "pending",
    job.failedReason,
    sessionId
  );
  res.json(response);
});

// Get all jobs
router.get("/jobs", async (req, res) => {
  const sessionId = req.headers["x-session-id"] as string;
  const states: JobState[] = ["active", "delayed", "wait"];
  const jobs = await jobQueue.getJobs(states);

  const response = createOperationMessage("listJobs", "success", undefined, sessionId);
  res.json(response);
});

export default router;
