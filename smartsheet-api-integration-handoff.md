# Smartsheet API Integration Developer Handoff

## Overview

This document provides a comprehensive overview of the Smartsheet API integration in the ChatSheetAI application. It covers the architecture, key components, recent fixes, and guidelines for future development.

## Architecture

The application integrates with the Smartsheet API to access and manipulate sheet data. The integration follows a client-server architecture:

1. **Server-side**: Node.js Express server that handles API requests, communicates with the Smartsheet API, and manages sessions.
2. **Client-side**: React application that displays sheet data and provides a user interface for interaction.

## Key Components

### Server-side Components

#### 1. Smartsheet Tools (`server/tools/smartsheet.ts`)

This module provides the core functionality for interacting with the Smartsheet API:

- **Client Initialization**: Uses dynamic ES module imports to create a Smartsheet client
- **Data Retrieval**: Fetches sheet data and formats it according to the application's schema
- **Data Manipulation**: Provides functions for updating rows, adding rows, etc.
- **Error Handling**: Includes retry logic and specific error handling for different scenarios

Key functions:

- `setAccessToken(token)`: Sets the access token for the Smartsheet API
- `ensureClient()`: Initializes the Smartsheet client with the current access token
- `getSheetInfo(params)`: Retrieves sheet data and formats it for the application
- `verifySheetAccess(sheetId)`: Verifies if a sheet is accessible with the current token
- `updateRow(sheetId, rowId, cells)`: Updates a row in a sheet
- `addRow(sheetId, cells)`: Adds a new row to a sheet

#### 2. API Routes (`server/routes/smartsheet.ts`)

Exposes endpoints for interacting with Smartsheet data:

- `POST /api/smartsheet/config`: Sets the Smartsheet configuration (access token and sheet ID)
- `GET /api/smartsheet/verify/:sheetId`: Verifies access to a specific sheet
- `GET /api/smartsheet/:sheetId`: Gets sheet data for a specific sheet

#### 3. Session Management (`server/routes/sessions.ts`)

Manages user sessions for the application:

- `POST /api/sessions`: Creates a new session with a sheet ID
- `GET /api/sessions/:sessionId`: Gets session information

#### 4. Authentication Middleware (`server/middleware/smartsheet-auth.ts`)

Ensures that Smartsheet API access is properly configured before allowing requests:

- Checks if the access token is set
- Skips verification for specific endpoints (e.g., `/config`, `/verify`)

### Client-side Components

#### 1. Smartsheet Context (`client/src/lib/smartsheet-context.tsx`)

Provides global state for Smartsheet-related data:

- Stores the current sheet ID and session ID
- Persists data in localStorage
- Provides functions for updating the state

#### 2. API Client (`client/src/lib/queryClient.ts`)

Handles API requests to the server:

- Includes the session ID in request headers
- Provides error handling for API requests

#### 3. Sheet Viewer (`client/src/components/smartsheet/sheet-viewer.tsx`)

Displays sheet data in a table format:

- Renders columns and rows from the sheet
- Provides filtering and sorting functionality
- Handles cell selection and formatting

#### 4. Sheet ID Modal (`client/src/components/smartsheet/fullscreen-sheet-id-modal.tsx`)

Prompts the user to enter a sheet ID:

- Creates a session for the sheet ID
- Verifies access to the sheet
- Updates the global context with the sheet ID and session ID

## Data Flow

1. User enters a sheet ID in the fullscreen modal
2. Client creates a session via `/api/sessions`
3. Client verifies sheet access via `/api/smartsheet/verify/:sheetId`
4. Client fetches sheet data via `/api/smartsheet/:sheetId`
5. Sheet data is displayed in the sheet viewer

## Recent Fixes

### 1. ES Module Import Fix

**Issue**: The server was using CommonJS `require()` in an ES module environment, causing the Smartsheet client initialization to fail.

**Fix**: Updated `ensureClient()` in `server/tools/smartsheet.ts` to use dynamic imports:

```typescript
async function ensureClient(): Promise<any> {
  if (!accessToken) {
    throw new Error("Smartsheet access token not configured");
  }

  if (!client) {
    try {
      // Initialize real Smartsheet client with access token
      // Use dynamic import for ES modules compatibility
      const smartsheetModule = await import("smartsheet");
      const smartsheet = smartsheetModule.default;

      client = smartsheet.createClient({
        accessToken,
        logLevel: "info",
      });

      console.log("Smartsheet client created successfully");
    } catch (error) {
      console.error("Error creating Smartsheet client:", error);
      throw error;
    }
  }

  return client;
}
```

### 2. Data Formatting Fix

**Issue**: The data returned from the Smartsheet API wasn't being properly formatted according to the expected schema, causing the client to display empty cells.

**Fix**: Updated `getSheetInfo()` in `server/tools/smartsheet.ts` to properly format the columns and rows:

```typescript
async function getSheetInfo(params: SheetInfoRequest) {
  return executeWithRetry(async () => {
    console.log(`Getting sheet info for sheet ID: ${params.sheetId}`);
    const client = await ensureClient();
    const response = await client.sheets.getSheet({ id: params.sheetId });

    // Format columns according to the schema
    const columns = response.columns.map((column: any) => ({
      id: column.id.toString(),
      title: column.title,
      type: getColumnType(column),
      isEditable: !column.locked,
      options: column.options || [],
      description: column.description,
      systemColumn: column.systemColumnType ? true : false,
    }));

    // Format rows according to the schema
    const rows = response.rows.map((row: any) => {
      const rowData: Record<string, any> = {
        id: row.id.toString(),
      };

      // Map cell values to column titles
      row.cells.forEach((cell: any, index: number) => {
        const column = response.columns[index];
        if (column) {
          rowData[column.title] = cell.value;
        }
      });

      return rowData;
    });

    return {
      data: {
        sheetId: params.sheetId,
        sheetName: response.name,
        columns: columns,
        rows: rows,
        totalRows: response.totalRows || rows.length,
      },
    };
  });
}
```

### 3. Session Handling Fix

**Issue**: The session validation middleware was using async/await incorrectly, causing issues with error handling.

**Fix**: Updated the session validation middleware in `server/routes.ts` to use promises:

```typescript
// Import storage at the top level to avoid dynamic imports in middleware
import { storage } from "./storage";

// Validate session ID for all other routes
router.use((req, res, next) => {
  // Skip session validation for session-related endpoints
  if (req.path.startsWith("/sessions")) {
    return next();
  }

  // Skip session validation for smartsheet/verify endpoint
  if (req.path.startsWith("/smartsheet/verify")) {
    return next();
  }

  const sessionId = req.headers["x-session-id"];
  if (!sessionId || typeof sessionId !== "string") {
    return res.status(400).json({
      error: "Missing or invalid session ID",
      code: "INVALID_SESSION",
    });
  }

  // Use a Promise to handle the async session validation
  storage
    .getSession(sessionId)
    .then((session) => {
      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return res.status(400).json({
          error: "Invalid session ID. Session not found.",
          code: "INVALID_SESSION",
        });
      }

      // Add the session to the request object for later use
      (req as any).session = session;
      next();
    })
    .catch((error) => {
      console.error(`Error validating session: ${error}`);
      return res.status(500).json({
        error: "Error validating session",
        code: "SERVER_ERROR",
      });
    });
});
```

### 4. Client-side Session ID Fix

**Issue**: The client wasn't including the session ID in API requests.

**Fix**: Updated the `apiRequest` function in `client/src/lib/queryClient.ts` to include the session ID from localStorage:

```typescript
export async function apiRequest(
  method: string,
  path: string,
  data?: unknown | undefined,
  headers?: Record<string, string>
): Promise<Response> {
  // Get session ID from localStorage
  let sessionHeaders: Record<string, string> = {};
  try {
    const storedSession = localStorage.getItem("smartsheet_session");
    if (storedSession) {
      const session = JSON.parse(storedSession);
      if (session.sessionId) {
        sessionHeaders = { "x-session-id": session.sessionId };
      }
    }
  } catch (error) {
    console.error("Error reading session from localStorage:", error);
  }

  const res = await fetch(path, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...sessionHeaders,
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}
```

## Diagnostic Tools

Several diagnostic tools have been created to help with debugging and testing:

### 1. `scripts/test-smartsheet-token.js`

Tests the Smartsheet access token to verify it's valid and has the necessary permissions.

Usage:

```bash
node scripts/test-smartsheet-token.js [token]
```

### 2. `scripts/test-session-handling.js`

Tests the session creation and validation flow.

Usage:

```bash
node scripts/test-session-handling.js [sheetId]
```

### 3. `scripts/test-sheet-data.js`

Tests the data formatting from the Smartsheet API.

Usage:

```bash
node scripts/test-sheet-data.js [sheetId] [token]
```

## Environment Setup

### Server Configuration (`server/.env`)

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/chatsheetai
TEST_DATABASE_URL=postgresql://username:password@localhost:5432/chatsheetai_test

# Azure OpenAI Configuration
AZURE_OPENAI_API_BASE=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_API_VERSION=2025-01-01-preview
AZURE_OPENAI_DEPLOYMENT=your_deployment_name
AZURE_OPENAI_MODEL=your_model_name

# Smartsheet Configuration
SMARTSHEET_ACCESS_TOKEN=your_smartsheet_access_token
SMARTSHEET_WEBHOOK_SECRET=your_webhook_secret
```

### Client Configuration (`client/.env`)

```env
# Frontend Environment Variables
VITE_API_URL=http://localhost:3000
```

## Common Issues and Troubleshooting

### 1. "Missing or invalid session ID" Error

This error occurs when the client tries to access an API endpoint without a valid session ID.

**Troubleshooting**:

- Check if the session ID is being stored in localStorage
- Verify that the session exists in the database
- Ensure the session ID is being included in the request headers

### 2. "Invalid Sheet ID or unable to access sheet" Error

This error occurs when the Smartsheet API can't access the specified sheet.

**Troubleshooting**:

- Verify that the sheet ID is correct
- Check if the access token has permission to access the sheet
- Run `scripts/test-sheet-access.js` to test access to the sheet

### 3. "Smartsheet access token not configured" Error

This error occurs when the Smartsheet access token is not set or is invalid.

**Troubleshooting**:

- Check if the `SMARTSHEET_ACCESS_TOKEN` environment variable is set
- Verify that the token is valid by running `scripts/test-smartsheet-token.js`
- Regenerate the token if necessary

### 4. Empty Sheet Data

This issue occurs when the sheet data is not being properly formatted.

**Troubleshooting**:

- Check the server logs for any errors in the `getSheetInfo` function
- Run `scripts/test-sheet-data.js` to test the data formatting
- Verify that the sheet has columns and rows

## Future Development

### 1. Improved Error Handling

The current error handling could be improved by:

- Adding more specific error types
- Providing more detailed error messages
- Implementing a centralized error handling system

### 2. Enhanced Data Validation

The data validation could be improved by:

- Adding more schema validation
- Implementing data transformation pipelines
- Adding data integrity checks

### 3. Performance Optimization

The performance could be improved by:

- Implementing caching for sheet data
- Adding pagination for large sheets
- Optimizing data processing

### 4. Additional Features

Potential features to add:

- Bulk operations for updating multiple rows
- Column filtering and sorting
- Data visualization
- Collaborative editing

## Conclusion

The Smartsheet API integration is now working correctly, with proper data formatting and error handling. The recent fixes have addressed the key issues with ES module imports, data formatting, and session handling. The diagnostic tools provide a way to test and debug the integration.

For any questions or issues, please refer to the troubleshooting section or contact the development team.
