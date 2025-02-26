#!/usr/bin/env node

/**
 * This script tests access to a specific Smartsheet sheet ID using the same code as the server
 * 
 * Usage:
 *   node scripts/test-sheet-access.js [sheetId] [token]
 * 
 * If no sheetId is provided, it will use 4104733329411972
 * If no token is provided, it will use the SMARTSHEET_ACCESS_TOKEN
 * environment variable from the server/.env file.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

// Get the sheet ID and token from command line arguments or environment variables
const sheetId = process.argv[2] || '4104733329411972';
const token = process.argv[3] || process.env.SMARTSHEET_ACCESS_TOKEN;

if (!token) {
  console.error('Error: No Smartsheet access token provided.');
  console.error('Please provide a token as a command line argument or set the SMARTSHEET_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

async function testSheetAccess() {
  try {
    console.log(`Testing access to Smartsheet with ID: ${sheetId}`);
    console.log(`Using token: ${token.substring(0, 5)}...${token.substring(token.length - 5)}`);
    
    // Import the Smartsheet SDK using dynamic import
    console.log('Importing Smartsheet SDK...');
    const smartsheetModule = await import('smartsheet');
    const smartsheet = smartsheetModule.default;
    
    // Create a client with the token
    console.log('Creating Smartsheet client...');
    const client = smartsheet.createClient({
      accessToken: token,
      logLevel: 'info'
    });
    
    // Test accessing the specific sheet
    console.log(`\nTesting access to sheet with ID: ${sheetId}...`);
    
    try {
      const sheetDetails = await client.sheets.getSheet({ id: sheetId });
      console.log(`\n✅ Successfully accessed sheet: ${sheetDetails.name}`);
      console.log(`- Sheet ID: ${sheetDetails.id}`);
      console.log(`- Columns: ${sheetDetails.columns.length}`);
      console.log(`- Rows: ${sheetDetails.rows.length}`);
      
      // Print column information
      console.log('\nColumn Information:');
      sheetDetails.columns.forEach((column, index) => {
        console.log(`${index + 1}. ${column.title} (ID: ${column.id}, Type: ${column.type})`);
      });
      
      // Print first few rows
      if (sheetDetails.rows.length > 0) {
        console.log('\nFirst 3 rows:');
        sheetDetails.rows.slice(0, 3).forEach((row, rowIndex) => {
          console.log(`Row ${rowIndex + 1} (ID: ${row.id}):`);
          row.cells.forEach((cell, cellIndex) => {
            const column = sheetDetails.columns[cellIndex];
            console.log(`  - ${column?.title || 'Unknown'}: ${cell.value || '(empty)'}`);
          });
        });
      }
      
    } catch (error) {
      console.error(`\n❌ Error accessing sheet: ${error.message}`);
      
      if (error.statusCode === 401) {
        console.error('Authentication failed. The token is invalid or expired.');
      } else if (error.statusCode === 403) {
        console.error('Permission denied. You do not have access to this sheet.');
      } else if (error.statusCode === 404) {
        console.error('Sheet not found. The sheet ID does not exist or has been deleted.');
      } else {
        console.error('Unknown error:', error);
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing sheet:');
    console.error(error.message || error);
    process.exit(1);
  }
}

testSheetAccess();