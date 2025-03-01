#!/usr/bin/env node

/**
 * Test script for the sheet viewer component
 * This script tests the sheet viewer functionality with the updated session management
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const SHEET_ID = process.env.TEST_SHEET_ID || '4104733329411972'; // Replace with your test sheet ID

// Generate a unique session ID for testing
const sessionId = crypto.randomUUID();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Helper function to log with colors
function log(message, color = colors.white) {
  console.log(`${color}${message}${colors.reset}`);
}

// Helper function to log errors
function logError(message, error) {
  console.error(`${colors.red}${message}${colors.reset}`);
  if (error) {
    console.error(`${colors.dim}${error.stack || error}${colors.reset}`);
  }
}

// Helper function to make API requests
async function apiRequest(method, path, body = null) {
  const url = `${API_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  log(`Making ${method} request to ${url}`, colors.cyan);
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}\n${JSON.stringify(data, null, 2)}`);
  }
  
  return data;
}

// Test functions
async function createSession() {
  log('\n=== Creating Session ===', colors.bright + colors.green);
  try {
    const response = await apiRequest('POST', '/sessions', {
      sheetId: SHEET_ID,
    });
    
    log(`Session created: ${response.sessionId}`, colors.green);
    return response.sessionId;
  } catch (error) {
    logError('Failed to create session', error);
    throw error;
  }
}

async function getSheetData(sheetId) {
  log('\n=== Getting Sheet Data ===', colors.bright + colors.green);
  try {
    const response = await apiRequest('GET', `/smartsheet/${sheetId}?sessionId=${sessionId}`);
    
    log(`Sheet data retrieved: ${response.data.sheetName}`, colors.green);
    log(`Columns: ${response.data.columns.length}`, colors.green);
    log(`Rows: ${response.data.rows.length}`, colors.green);
    
    return response.data;
  } catch (error) {
    logError('Failed to get sheet data', error);
    throw error;
  }
}

async function getSessionInfo(sessionId) {
  log('\n=== Getting Session Info ===', colors.bright + colors.green);
  try {
    const response = await apiRequest('GET', `/sessions/${sessionId}`);
    
    log(`Session info retrieved: ${response.id}`, colors.green);
    log(`Session state: ${response.state}`, colors.green);
    
    return response;
  } catch (error) {
    logError('Failed to get session info', error);
    throw error;
  }
}

// Main test function
async function runTests() {
  log('\n=== Starting Sheet Viewer Tests ===', colors.bright + colors.magenta);
  log(`Using session ID: ${sessionId}`, colors.yellow);
  log(`Using sheet ID: ${SHEET_ID}`, colors.yellow);
  
  try {
    // Step 1: Create a session
    const createdSessionId = await createSession();
    
    // Step 2: Get session info
    const sessionInfo = await getSessionInfo(createdSessionId);
    
    // Step 3: Get sheet data
    const sheetData = await getSheetData(SHEET_ID);
    
    // Step 4: Verify the session state
    const updatedSessionInfo = await getSessionInfo(createdSessionId);
    
    log('\n=== Test Results ===', colors.bright + colors.green);
    log(`Session created: ${createdSessionId === sessionId ? 'Success' : 'Failed'}`, colors.green);
    log(`Session state: ${updatedSessionInfo.state}`, colors.green);
    log(`Sheet data retrieved: ${sheetData ? 'Success' : 'Failed'}`, colors.green);
    
    log('\n=== Test Completed Successfully ===', colors.bright + colors.green);
  } catch (error) {
    logError('\n=== Test Failed ===', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  logError('Unhandled error in tests', error);
  process.exit(1);
});