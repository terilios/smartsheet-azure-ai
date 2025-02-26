# Smartsheet API Access Issue Implementation Plan

## Overview

This plan outlines the steps to fix the Smartsheet API access issue that's causing the 400 Bad Request error with the message "Invalid Sheet ID or unable to access sheet".

## Phase 1: Verify and Update Access Token

### Step 1: Test Current Access Token

```bash
# Test the token with curl to see if it's valid
curl -H "Authorization: Bearer Gc7MiMcf13U6uLbUe6VbGDQ0vVNLbkngXWmMr" \
     -H "Content-Type: application/json" \
     https://api.smartsheet.com/2.0/users/me
```

### Step 2: Generate New Access Token (if needed)

1. Go to Smartsheet Developer Tools: https://app.smartsheet.com/b/home?lx=pOG4v9lfJFh-aB21-QZ_rg
2. Navigate to "Personal Settings" > "API Access"
3. Generate a new access token
4. Update the server/.env file with the new token

## Phase 2: Implement Real Smartsheet Client

### Step 1: Update server/tools/smartsheet.ts

Replace the mock implementation with the actual Smartsheet SDK:

```typescript
import { withRetry } from "../utils/retry";

// Smartsheet client configuration
let accessToken: string | null = null;
let client: any = null;

function setAccessToken(token: string): void {
  accessToken = token;
  client = null; // Reset client so it will be recreated with new token
}

async function ensureClient(): Promise<any> {
  if (!accessToken) {
    throw new Error("Smartsheet access token not configured");
  }

  if (!client) {
    // Initialize real Smartsheet client with access token
    const smartsheet = require("smartsheet");
    client = smartsheet.createClient({
      accessToken,
      logLevel: "info",
    });
  }

  return client;
}

// Wrapper function with retry logic for handling token expiration
async function executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  const result = await withRetry(
    async () => {
      try {
        return await operation();
      } catch (error: any) {
        // Check if error is due to expired token or authentication issues
        if (
          error.statusCode === 401 ||
          (error.message &&
            (error.message.includes("expired") ||
              error.message.includes("Invalid") ||
              error.message.includes("authentication")))
        ) {
          console.error(
            "Authentication error with Smartsheet API:",
            error.message
          );
          throw new Error(
            "Smartsheet authentication failed. Please check your access token."
          );
        }
        throw error;
      }
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      backoffFactor: 2,
    }
  );

  if (!result.success) {
    throw result.error || new Error("Operation failed with unknown error");
  }

  if (result.result === undefined) {
    throw new Error("Operation succeeded but returned no result");
  }

  return result.result;
}
```

### Step 2: Implement Sheet Info Retrieval

Add functions to get sheet information and handle rows:

```typescript
async function getSheetInfo(params: SheetInfoRequest) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    const response = await client.sheets.getSheet({ id: params.sheetId });

    return {
      data: {
        sheetId: params.sheetId,
        sheetName: response.name,
        columns: response.columns,
        rows: response.rows,
      },
    };
  });
}

async function updateRow(
  sheetId: string,
  rowId: number,
  cells: { columnId: number; value: any }[]
) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    const row = {
      id: rowId,
      cells: cells,
    };

    const response = await client.sheets.updateRow({ sheetId, body: row });

    return {
      success: true,
      message: "Row updated successfully",
      data: response,
    };
  });
}

async function addRow(
  sheetId: string,
  cells: { columnId: number; value: any }[]
) {
  return executeWithRetry(async () => {
    const client = await ensureClient();
    const row = { cells };

    const response = await client.sheets.addRow({ sheetId, body: row });

    return {
      success: true,
      message: "Row added successfully",
      data: response,
    };
  });
}
```

### Step 3: Update Exports

Update the exports to include the new functions:

```typescript
export const smartsheetTools = {
  mapSmartsheetColumnType,
  getColumnType,
  validateColumnType,
  isValidColumnType,
  getDefaultValueForType,
  setAccessToken,
  ensureClient,
  getSheetInfo,
  updateRow,
  addRow,
  executeWithRetry,
};

// Also export individual functions for direct imports
export {
  mapSmartsheetColumnType,
  getColumnType,
  validateColumnType,
  isValidColumnType,
  getDefaultValueForType,
  setAccessToken,
  ensureClient,
  getSheetInfo,
  updateRow,
  addRow,
  executeWithRetry,
  type SheetInfoRequest,
};
```

## Phase 3: Enhance Error Handling

### Step 1: Update server/routes/smartsheet.ts

Improve error handling in the GET endpoint:

```typescript
// Get sheet information by ID
router.get("/:sheetId", async (req, res) => {
  try {
    const sheetId = req.params.sheetId;

    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: "Sheet ID is required",
      });
    }

    // Use the environment variable for access token
    smartsheetTools.setAccessToken(process.env.SMARTSHEET_ACCESS_TOKEN || "");

    // Get actual sheet information from Smartsheet API
    const result = await smartsheetTools.getSheetInfo({ sheetId });

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Error retrieving sheet information:", error);

    // Provide more specific error messages based on the error type
    if (error.statusCode === 401) {
      res.status(401).json({
        success: false,
        error:
          "Authentication failed. Please check your Smartsheet access token.",
      });
    } else if (error.statusCode === 403) {
      res.status(403).json({
        success: false,
        error: "You don't have permission to access this sheet.",
      });
    } else if (error.statusCode === 404) {
      res.status(404).json({
        success: false,
        error: "Sheet not found. Please check the Sheet ID.",
      });
    } else {
      res.status(error.statusCode || 400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve sheet information",
      });
    }
  }
});
```

## Phase 4: Testing and Verification

### Step 1: Test with Valid Sheet ID

1. Start the server with the updated code
2. Open the application in a browser
3. Enter a valid Sheet ID that you have access to
4. Verify that the sheet loads successfully

### Step 2: Test Error Handling

1. Enter an invalid Sheet ID
2. Verify that you get a clear error message
3. Enter a Sheet ID for a sheet you don't have access to
4. Verify that you get a permission error message

### Step 3: Monitor Logs

1. Monitor the server logs for any errors
2. Check for authentication issues or API rate limiting

## Phase 5: Documentation and Knowledge Transfer

### Step 1: Update Documentation

1. Document the changes made to fix the issue
2. Update the README.md with instructions for setting up Smartsheet API access
3. Add troubleshooting tips for common issues

### Step 2: Knowledge Transfer

1. Share the updated documentation with the team
2. Explain the changes made and why they were necessary
3. Provide guidance on how to handle similar issues in the future

## Conclusion

By following this implementation plan, we should be able to fix the Smartsheet API access issue and ensure that the application can successfully connect to the Smartsheet API and access the requested sheet data.
