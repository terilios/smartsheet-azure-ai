# Smartsheet API Access Issue Analysis

## Problem Overview

Based on the screenshot and code review, the application is encountering a 400 Bad Request error with the message "Invalid Sheet ID or unable to access sheet" when attempting to access the Smartsheet API.

## Root Causes

### 1. Missing or Invalid Access Token

- The server requires a `SMARTSHEET_ACCESS_TOKEN` environment variable (checked in server/index.ts)
- This token is not defined in the docker-compose.yml file
- Without a valid token, all API requests will fail

### 2. Mock Implementation in Server Code

- The server-side Smartsheet tools (server/tools/smartsheet.ts) contains a mock implementation
- It doesn't actually connect to the real Smartsheet API
- Line 20-21 shows: `// This is a placeholder - you would typically initialize your actual Smartsheet client here`

### 3. Authentication Flow Issues

- When a user enters a Sheet ID in the modal, the client makes a request to `/api/smartsheet/${trimmedSheetId}`
- This endpoint in server/routes/smartsheet.ts (line 46-77) doesn't actually validate with the real Smartsheet API
- It's using the mock implementation that doesn't perform real validation

### 4. Environment Configuration

- The error occurs because the server is trying to use a mock implementation without proper authentication

## Detailed Plan to Fix the Issue

### 1. Implement the Real Smartsheet Client

- Replace the mock implementation in server/tools/smartsheet.ts with the actual Smartsheet SDK
- Use the client-side implementation in client/src/lib/smartsheet.ts as a reference

```typescript
// Example implementation for server/tools/smartsheet.ts
import { Client } from "smartsheet";

let accessToken: string | null = null;
let client: Client | null = null;

function setAccessToken(token: string): void {
  accessToken = token;
  client = null; // Reset client so it will be recreated with new token
}

async function ensureClient(): Promise<Client> {
  if (!accessToken) {
    throw new Error("Smartsheet access token not configured");
  }

  if (!client) {
    // Initialize real Smartsheet client with access token
    client = new Client({
      accessToken,
      logLevel: "info",
    });
  }

  return client;
}

async function getSheetInfo(params: SheetInfoRequest) {
  const client = await ensureClient();
  return client.sheets.getSheet({ id: params.sheetId });
}
```

### 2. Set Up Proper Environment Variables

- Create a .env file in the server directory with a valid SMARTSHEET_ACCESS_TOKEN
- Update docker-compose.yml to include this environment variable

```yaml
# Example addition to docker-compose.yml
services:
  server:
    environment:
      SMARTSHEET_ACCESS_TOKEN: ${SMARTSHEET_ACCESS_TOKEN}
      SMARTSHEET_WEBHOOK_SECRET: ${SMARTSHEET_WEBHOOK_SECRET}
```

### 3. Update the Server Routes

- Modify server/routes/smartsheet.ts to use the real Smartsheet client
- Implement proper error handling for authentication issues

```typescript
// Example update for server/routes/smartsheet.ts
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
      data: {
        sheetId,
        sheetName: result.name,
        columns: result.columns,
        rows: result.rows,
      },
    });
  } catch (error) {
    console.error("Error retrieving sheet information:", error);
    res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to retrieve sheet information",
    });
  }
});
```

### 4. Implement Token Refresh Mechanism

- Add logic to detect when the token is expired and refresh it
- Use the retry utility in server/utils/retry.ts for handling transient failures

```typescript
// Example token refresh mechanism
import { retry } from "../utils/retry";

async function getSheetInfoWithRetry(params: SheetInfoRequest) {
  return retry(
    async () => {
      try {
        return await getSheetInfo(params);
      } catch (error) {
        // Check if error is due to expired token
        if (error.message?.includes("expired") || error.statusCode === 401) {
          // Implement token refresh logic here
          // This might involve fetching a new token from a secure storage
          const newToken = await refreshToken();
          setAccessToken(newToken);
          throw new Error("Token refreshed, retrying request");
        }
        throw error;
      }
    },
    {
      retries: 3,
      minTimeout: 1000,
      factor: 2,
    }
  );
}
```

## Next Steps

1. Implement the real Smartsheet client integration
2. Set up proper environment variables
3. Test the integration with a valid Sheet ID and access token
4. Add proper error handling and user feedback
5. Consider implementing a token refresh mechanism for long-running applications

By addressing these issues, the application should be able to successfully connect to the Smartsheet API and access the requested sheet data.
