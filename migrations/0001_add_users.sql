-- Step 1: Create users table
CREATE TABLE "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "name" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Step 2: Handle default user (either insert new or update existing)
-- First, check if the old default user exists and update it if it does
UPDATE "users"
SET "id" = '00000000-0000-0000-0000-000000000000'
WHERE "id" = 'default-user-id';

-- If no rows were updated, insert the new default user
INSERT INTO "users" ("id", "email", "name", "created_at", "updated_at")
SELECT '00000000-0000-0000-0000-000000000000', 'default@childrens.harvard.edu', 'Default User', now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM "users" WHERE "id" = '00000000-0000-0000-0000-000000000000'
);
--> statement-breakpoint

-- Step 3: Add user_id column to chat_sessions table
ALTER TABLE "chat_sessions" ADD COLUMN "user_id" text;
--> statement-breakpoint

-- Step 4: Update existing sessions to use the default user
-- Handle both NULL user_id and old default-user-id format
UPDATE "chat_sessions"
SET "user_id" = '00000000-0000-0000-0000-000000000000'
WHERE "user_id" IS NULL OR "user_id" = 'default-user-id';
--> statement-breakpoint

-- Step 5: Create index on user_id for better query performance
CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions" ("user_id");
--> statement-breakpoint

-- Step 6: Add foreign key constraint after ensuring all rows have valid user_id values
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
--> statement-breakpoint

-- Step 7: Make user_id NOT NULL now that all rows have a value
ALTER TABLE "chat_sessions" ALTER COLUMN "user_id" SET NOT NULL;