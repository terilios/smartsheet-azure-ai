-- Add metadata column to chat_sessions table
ALTER TABLE "chat_sessions" ADD COLUMN "metadata" jsonb;
--> statement-breakpoint