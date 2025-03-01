-- Add state and error columns to chat_sessions table
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'INITIALIZING';
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS error TEXT;