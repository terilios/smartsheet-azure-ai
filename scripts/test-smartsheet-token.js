#!/usr/bin/env node

/**
 * This script tests the Smartsheet access token to verify it's valid
 * and has the necessary permissions.
 * 
 * Usage:
 *   node scripts/test-smartsheet-token.js [token]
 * 
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

// Get the token from command line arguments or environment variables
const token = process.argv[2] || process.env.SMARTSHEET_ACCESS_TOKEN;

if (!token) {
  console.error('Error: No Smartsheet access token provided.');
  console.error('Please provide a token as a command line argument or set the SMARTSHEET_ACCESS_TOKEN environment variable.');
  process.exit(1);
}

async function testToken() {
  try {
    console.log('Testing Smartsheet access token...');
    
    // Import the Smartsheet SDK
    const smartsheet = (await import('smartsheet')).default;
    
    // Create a client with the token
    const client = smartsheet.createClient({
      accessToken: token,
      logLevel: 'info'
    });
    
    // Test the token by getting the current user's information
    console.log('Fetching user information...');
    const userInfo = await client.users.getCurrentUser();
    
    console.log('\n✅ Token is valid!');
    console.log('\nUser Information:');
    console.log(`- Name: ${userInfo.firstName} ${userInfo.lastName}`);
    console.log(`- Email: ${userInfo.email}`);
    console.log(`- Admin: ${userInfo.admin ? 'Yes' : 'No'}`);
    console.log(`- Licensed: ${userInfo.licensedSheetCreator ? 'Yes' : 'No'}`);
    
    // Test listing sheets to verify permissions
    console.log('\nFetching sheets...');
    const sheets = await client.sheets.listSheets();
    
    console.log(`\n✅ Found ${sheets.data.length} sheets.`);
    
    if (sheets.data.length > 0) {
      console.log('\nFirst 5 sheets:');
      sheets.data.slice(0, 5).forEach((sheet, index) => {
        console.log(`${index + 1}. ${sheet.name} (ID: ${sheet.id})`);
      });
    }
    
    console.log('\n✅ Token has necessary permissions to list sheets.');
    
    // If there's at least one sheet, try to access it
    if (sheets.data.length > 0) {
      const firstSheet = sheets.data[0];
      console.log(`\nTesting access to sheet: ${firstSheet.name} (ID: ${firstSheet.id})...`);
      
      try {
        const sheetDetails = await client.sheets.getSheet({ id: firstSheet.id });
        console.log(`\n✅ Successfully accessed sheet: ${sheetDetails.name}`);
        console.log(`- Columns: ${sheetDetails.columns.length}`);
        console.log(`- Rows: ${sheetDetails.rows.length}`);
      } catch (error) {
        console.error(`\n❌ Error accessing sheet: ${error.message}`);
        console.error('This may indicate permission issues with this specific sheet.');
      }
    }
    
    console.log('\n✅ Token validation complete.');
    
  } catch (error) {
    console.error('\n❌ Error testing token:');
    
    if (error.statusCode === 401) {
      console.error('Authentication failed. The token is invalid or expired.');
    } else if (error.statusCode === 403) {
      console.error('Permission denied. The token does not have the necessary permissions.');
    } else {
      console.error(error.message || error);
    }
    
    process.exit(1);
  }
}

testToken();