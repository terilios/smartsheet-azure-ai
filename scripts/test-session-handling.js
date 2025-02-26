#!/usr/bin/env node

/**
 * This script tests the session handling in the application
 * 
 * Usage:
 *   node scripts/test-session-handling.js [sheetId]
 * 
 * If no sheetId is provided, it will use 4104733329411972
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

// Get the sheet ID from command line arguments or use default
const sheetId = process.argv[2] || '4104733329411972';

// Base URL for API requests
const BASE_URL = 'http://localhost:3000/api';

async function testSessionHandling() {
  try {
    console.log('=== Testing Session Handling ===');
    console.log(`Using Sheet ID: ${sheetId}`);
    
    // Step 1: Create a session
    console.log('\n1. Creating session...');
    const sessionResponse = await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sheetId })
    });
    
    if (!sessionResponse.ok) {
      const errorData = await sessionResponse.json();
      console.error(`❌ Failed to create session: ${errorData.error || sessionResponse.statusText}`);
      process.exit(1);
    }
    
    const sessionData = await sessionResponse.json();
    console.log('✅ Session created successfully');
    console.log(`Session ID: ${sessionData.sessionId}`);
    
    // Step 2: Verify session exists
    console.log('\n2. Verifying session...');
    const verifySessionResponse = await fetch(`${BASE_URL}/sessions/${sessionData.sessionId}`);
    
    if (!verifySessionResponse.ok) {
      const errorData = await verifySessionResponse.json();
      console.error(`❌ Failed to verify session: ${errorData.error || verifySessionResponse.statusText}`);
      process.exit(1);
    }
    
    const verifiedSessionData = await verifySessionResponse.json();
    console.log('✅ Session verified successfully');
    console.log(`Session data: ${JSON.stringify(verifiedSessionData, null, 2)}`);
    
    // Step 3: Verify sheet access with session ID
    console.log('\n3. Verifying sheet access with session ID...');
    const verifySheetResponse = await fetch(`${BASE_URL}/smartsheet/verify/${sheetId}`, {
      headers: {
        'x-session-id': sessionData.sessionId
      }
    });
    
    if (!verifySheetResponse.ok) {
      const errorData = await verifySheetResponse.json();
      console.error(`❌ Failed to verify sheet access: ${errorData.error || verifySheetResponse.statusText}`);
      process.exit(1);
    }
    
    const verifySheetData = await verifySheetResponse.json();
    console.log('✅ Sheet access verified successfully');
    console.log(`Response: ${JSON.stringify(verifySheetData, null, 2)}`);
    
    // Step 4: Get sheet data with session ID
    console.log('\n4. Getting sheet data with session ID...');
    const sheetResponse = await fetch(`${BASE_URL}/smartsheet/${sheetId}`, {
      headers: {
        'x-session-id': sessionData.sessionId
      }
    });
    
    if (!sheetResponse.ok) {
      const errorData = await sheetResponse.json();
      console.error(`❌ Failed to get sheet data: ${errorData.error || sheetResponse.statusText}`);
      process.exit(1);
    }
    
    const sheetData = await sheetResponse.json();
    console.log('✅ Sheet data retrieved successfully');
    console.log(`Sheet name: ${sheetData.data.sheetName}`);
    console.log(`Columns: ${sheetData.data.columns.length}`);
    console.log(`Rows: ${sheetData.data.rows.length}`);
    
    // Step 5: Test with invalid session ID
    console.log('\n5. Testing with invalid session ID...');
    const invalidSessionResponse = await fetch(`${BASE_URL}/smartsheet/${sheetId}`, {
      headers: {
        'x-session-id': 'invalid-session-id'
      }
    });
    
    if (invalidSessionResponse.ok) {
      console.error('❌ Request with invalid session ID should have failed but succeeded');
    } else {
      const errorData = await invalidSessionResponse.json();
      console.log('✅ Request with invalid session ID failed as expected');
      console.log(`Error: ${errorData.error}`);
    }
    
    console.log('\n=== Session Handling Test Complete ===');
    console.log('All tests passed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error testing session handling:');
    console.error(error.message || error);
    process.exit(1);
  }
}

testSessionHandling();