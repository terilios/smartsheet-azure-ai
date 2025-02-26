#!/usr/bin/env node

/**
 * This script tests the Smartsheet API and data formatting
 * 
 * Usage:
 *   node scripts/test-sheet-data.js [sheetId] [token]
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

// Function to get column type
function getColumnType(column) {
  if (!column || !column.type) {
    return "TEXT_NUMBER";
  }

  // Normalize the type string
  const normalizedType = column.type.toUpperCase().replace(/[^A-Z_]/g, '_');

  switch (normalizedType) {
    case "TEXT_NUMBER":
    case "DATE":
    case "CHECKBOX":
    case "PICKLIST":
    case "CONTACT_LIST":
    case "TEXT":
    case "NUMBER":
    case "SYSTEM":
      return normalizedType;
    default:
      return "TEXT_NUMBER";
  }
}

async function testSheetData() {
  try {
    console.log(`Testing Smartsheet data formatting for sheet ID: ${sheetId}`);
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
    
    // Get the sheet data
    console.log(`\nFetching sheet data for ID: ${sheetId}...`);
    const response = await client.sheets.getSheet({ id: sheetId });
    
    console.log(`\n✅ Successfully fetched sheet: ${response.name}`);
    console.log(`- Sheet ID: ${response.id}`);
    console.log(`- Columns: ${response.columns.length}`);
    console.log(`- Rows: ${response.rows.length}`);
    
    // Format columns according to the schema
    console.log('\nFormatting columns...');
    const columns = response.columns.map((column) => {
      console.log(`- Column: ${column.title} (${column.type || 'unknown type'})`);
      return {
        id: column.id.toString(),
        title: column.title,
        type: getColumnType(column),
        isEditable: !column.locked,
        options: column.options || [],
        description: column.description,
        systemColumn: column.systemColumnType ? true : false
      };
    });
    
    // Format rows according to the schema
    console.log('\nFormatting rows...');
    const rows = response.rows.map((row, rowIndex) => {
      const rowData = {
        id: row.id.toString()
      };
      
      // Map cell values to column titles
      row.cells.forEach((cell, index) => {
        const column = response.columns[index];
        if (column) {
          rowData[column.title] = cell.value;
        }
      });
      
      if (rowIndex < 3) {
        console.log(`- Row ${rowIndex + 1} sample data:`, JSON.stringify(rowData, null, 2));
      }
      
      return rowData;
    });
    
    // Create the formatted data
    const formattedData = {
      sheetId: sheetId,
      sheetName: response.name,
      columns: columns,
      rows: rows,
      totalRows: response.totalRows || rows.length
    };
    
    console.log('\nFormatted data summary:');
    console.log(`- Sheet name: ${formattedData.sheetName}`);
    console.log(`- Columns: ${formattedData.columns.length}`);
    console.log(`- Rows: ${formattedData.rows.length}`);
    console.log(`- Total rows: ${formattedData.totalRows}`);
    
    // Save the formatted data to a file for inspection
    const outputFile = path.join(__dirname, 'formatted-sheet-data.json');
    fs.writeFileSync(outputFile, JSON.stringify(formattedData, null, 2));
    console.log(`\nFormatted data saved to: ${outputFile}`);
    
  } catch (error) {
    console.error('\n❌ Error testing sheet data:');
    console.error(error.message || error);
    process.exit(1);
  }
}

testSheetData();