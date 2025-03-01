-- Migration: Seed Default User
-- This migration inserts a default user into the "users" table to satisfy the foreign key constraint in "chat_sessions".
INSERT INTO users (id, email, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'default@childrens.harvard.edu',
  'Default User',
  '2025-02-26 18:33:02.704079',
  '2025-02-26 18:33:02.704079'
)
ON CONFLICT (id) DO NOTHING;
