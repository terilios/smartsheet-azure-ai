import { Router } from "express";
import { z } from "zod";
import { operationMessageSchema, type OperationMessage } from "@shared/schema";
import { jobQueue } from "../jobs/queue";
import crypto from "crypto";

const router = Router();

// Get job status
router.get("/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const job = await jobQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      error: "Job not found",
      code: "JOB_NOT_FOUND"
    });
  }

  const state = await job.getState();
  const result = job.returnvalue as OperationMessage | undefined;
  const error = job.failedReason;

  const response: OperationMessage = {
    metadata: {
      type: "SYSTEM",
      id: jobId,
      timestamp: new Date().toISOString(),
      operation: job.name || undefined,
      status: state === "completed" ? "success" : 
             state === "failed" ? "error" :
             state === "active" ? "pending" : "pending",
      error: error || undefined,
      sessionId: undefined,
      name: undefined,
    },
    content: result?.content || ""
  };

  res.json(response);
});

// Cancel job
router.delete("/:jobId", async (req, res) => {
  const jobId = req.params.jobId;
  const job = await jobQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      error: "Job not found",
      code: "JOB_NOT_FOUND"
    });
  }

  await job.remove();

  const response: OperationMessage = {
    metadata: {
      type: "SYSTEM",
      id: jobId,
      timestamp: new Date().toISOString(),
      operation: job.name || undefined,
      status: "success",
      sessionId: undefined,
      name: undefined,
    },
    content: "Job cancelled successfully"
  };

  res.json(response);
});

export default router;
