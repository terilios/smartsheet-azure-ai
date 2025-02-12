#!/usr/bin/env tsx
import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setupTestDatabase() {
  const dbName = 'chatsheetai_test';
  
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable must be set');
    }

    // Extract base connection info from DATABASE_URL
    const url = new URL(process.env.DATABASE_URL);
    const baseUrl = `${url.protocol}//${url.username}:${url.password}@${url.hostname}:${url.port}`;
    
    // Create test database
    console.log(`Creating test database: ${dbName}`);
    await execAsync(`createdb ${dbName}`);
    
    // Set TEST_DATABASE_URL in .env if not already set
    const testUrl = `${baseUrl}/${dbName}`;
    if (!process.env.TEST_DATABASE_URL) {
      console.log('Adding TEST_DATABASE_URL to .env');
      await execAsync(`echo "\nTEST_DATABASE_URL=${testUrl}" >> .env`);
    }
    
    // Run migrations on test database
    console.log('Running migrations on test database...');
    process.env.TEST_DATABASE_URL = testUrl;
    await execAsync('npm run migrate');
    
    console.log('Test database setup complete!');
    console.log('Migrations applied successfully.');
    console.log(`You can now run tests with: npm run test:server`);
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        console.log(`Test database ${dbName} already exists`);
      } else {
        console.error('Error setting up test database:', error.message);
        process.exit(1);
      }
    }
  }
}

setupTestDatabase().catch(console.error);
