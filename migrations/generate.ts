import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function generateMigration() {
  console.log('Generating migration...');
  
  try {
    // Run drizzle-kit generate command
    const { stdout, stderr } = await execAsync('drizzle-kit generate:pg');
    
    if (stderr) {
      console.error('Error output:', stderr);
    }
    
    console.log('Migration generation output:', stdout);
    console.log('Migration files generated successfully');
    
    // Connect to database and run migrations
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool);

    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations applied successfully');

    await pool.end();
  } catch (error) {
    console.error('Error generating/running migration:', error);
    process.exit(1);
  }
}

generateMigration().catch(console.error);
