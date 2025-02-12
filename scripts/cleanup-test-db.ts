#!/usr/bin/env tsx
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';

const execAsync = promisify(exec);

async function cleanupTestDatabase() {
  const dbName = 'chatsheetai_test';
  
  try {
    // Drop test database
    console.log(`Dropping test database: ${dbName}`);
    await execAsync(`dropdb --if-exists ${dbName}`);
    
    // Remove TEST_DATABASE_URL from .env
    console.log('Removing TEST_DATABASE_URL from .env');
    try {
      const envContent = await readFile('.env', 'utf-8');
      const updatedContent = envContent
        .split('\n')
        .filter(line => !line.startsWith('TEST_DATABASE_URL='))
        .join('\n');
      await writeFile('.env', updatedContent);
    } catch (error) {
      console.log('No .env file found or no TEST_DATABASE_URL to remove');
    }
    
    console.log('Test database cleanup complete!');
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error cleaning up test database:', error.message);
      process.exit(1);
    }
  }
}

cleanupTestDatabase().catch(console.error);
