# Sheet Viewer Restoration Plan

## Overview

This document outlines a plan to restore the sheet viewer to its previous working state while incorporating the necessary session management updates. The goal is to ensure the sheet viewer renders correctly as it did before, while maintaining compatibility with the new session management system.

## Approach

We'll take a methodical approach to restore the sheet viewer functionality:

1. **Identify the Last Working Version**: Determine the last known working version of the sheet viewer component.
2. **Extract Core Functionality**: Extract the core rendering functionality from the working version.
3. **Identify Required Updates**: Identify the minimal session management updates needed.
4. **Create a Clean Implementation**: Implement a clean version that combines the working rendering with the required session updates.
5. **Test and Verify**: Test the implementation to ensure it renders correctly.

## Step 1: Identify the Last Working Version

We need to identify the last known working version of the sheet viewer component. This could be from:

- A previous commit in version control
- A backup of the file
- A deployed version of the application

Once identified, we'll use this as our baseline for the restoration.

## Step 2: Extract Core Functionality

From the working version, we'll extract:

- The core rendering logic
- The component structure
- The styling and layout
- The state management

We'll focus on preserving the parts that make the sheet viewer render correctly.

## Step 3: Identify Required Updates

The minimal session management updates needed are:

1. **Session ID Handling**: Ensure the component can receive and use a session ID.
2. **API Integration**: Update API calls to include the session ID.
3. **Error Handling**: Ensure proper error handling for session-related issues.

## Step 4: Create a Clean Implementation

### 4.1 Restore the SmartsheetContainer Component

```typescript
// client/src/components/smartsheet/smartsheet-container.tsx

export default function SmartsheetContainer({
  sheetId,
}: SmartsheetContainerProps): JSX.Element {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const {
    sheetData,
    isLoading,
    error,
    refreshSheetData,
    lastUpdated,
    setCurrentSheetId,
    currentSessionId, // Include this for session management
  } = useSmartsheet();

  // Set the current sheet ID when the component mounts or sheetId changes
  useEffect(() => {
    setCurrentSheetId(sheetId);
  }, [sheetId, setCurrentSheetId]);

  // Close the sheet after successful configuration
  useEffect(() => {
    if (configSaved) {
      const timer = setTimeout(() => {
        setIsConfigOpen(false);
        setConfigSaved(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [configSaved]);

  // Early return to ensure hooks are called consistently when sheetData is null
  if (!error && !isLoading && !sheetData) {
    return (
      <div className="h-full flex items-center justify-center">
        Loading sheet data...
      </div>
    );
  }

  const content =
    error?.code === "SMARTSHEET_NOT_CONFIGURED" ? (
      <ConfigurationError onConfigure={() => setIsConfigOpen(true)} />
    ) : (
      <div className="h-full flex flex-col">
        {sheetData && (
          <Header
            sheetName={sheetData.sheetName}
            sheetId={sheetId}
            columns={sheetData.columns}
            onConfigureClick={() => setIsConfigOpen(true)}
            onRefresh={refreshSheetData}
            lastUpdated={lastUpdated}
          />
        )}
        <div className="flex-1 overflow-auto">
          <SheetViewer
            data={sheetData || undefined}
            isLoading={isLoading}
            error={error}
            onRetry={refreshSheetData}
            sessionId={currentSessionId} // Pass the session ID to SheetViewer
          />
        </div>
      </div>
    );

  return (
    <>
      {content}
      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        {/* Sheet content */}
      </Sheet>
    </>
  );
}
```

### 4.2 Restore the SheetViewer Component

```typescript
// client/src/components/smartsheet/sheet-viewer.tsx

export default function SheetViewer({
  data,
  isLoading,
  error,
  onRetry,
  showExtra = false,
  sessionId,
}: SheetViewerProps): JSX.Element {
  const { info } = useNotification();

  // Always call hooks unconditionally: even if showExtra is false.
  const [extraData, setExtraData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    column: string | null;
    direction: "asc" | "desc";
  }>({ column: null, direction: "asc" });
  const [selection, setSelection] = useState<Selection>({
    type: "none",
    rowIndices: [],
    columnIds: [],
  });
  const [cellAlignments, setCellAlignments] = useState<
    Record<string, CellAlignment>
  >({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    data ? Object.fromEntries(data.columns.map((col) => [col.id, 200])) : {}
  );
  const [wrapText, setWrapText] = useState(true);

  useEffect(() => {
    if (!isLoading && !error && !data) {
      info(
        "No Sheet Data",
        "No sheet data is currently available. Please check your sheet ID or configuration."
      );
    }
    if (error) {
      eventBus.publish(EventType.ERROR_OCCURRED, {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: error.details,
        source: "SheetViewer",
        timestamp: new Date().toISOString(),
      });
    }
  }, [isLoading, error, data, info]);

  const handleConfigure = useCallback(() => {
    eventBus.publish(EventType.SHEET_DATA_UPDATED, {
      action: "configure",
      timestamp: new Date().toISOString(),
    });
  }, []);

  const handleRetry = useCallback(() => {
    eventBus.publish(EventType.SHEET_DATA_UPDATED, {
      action: "retry",
      timestamp: new Date().toISOString(),
    });
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState error={error} onRetry={onRetry} onRetryClick={handleRetry} />
    );
  }

  if (!data) {
    return <EmptyState onConfigure={handleConfigure} />;
  }

  const filteredRows = useMemo(() => {
    if (!searchTerm) return data.rows;
    return data.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data.rows, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.column) {
      return filteredRows;
    }
    const sorted = [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.column!];
      const bVal = b[sortConfig.column!];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = aVal < bVal ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [filteredRows, sortConfig]);

  // Rest of the component...
}
```

### 4.3 Update the SmartsheetContext Provider

```typescript
// client/src/lib/smartsheet-context.tsx

// Function to refresh sheet data with caching
const refreshSheetData = async () => {
  if (!currentSheetId || !currentSessionId) {
    console.warn("Cannot refresh sheet data: No sheet ID or session ID");
    return;
  }

  // Check if we can use cached data
  if (cacheConfig.enabled && isCacheValid()) {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const parsedCache = JSON.parse(cachedData) as StoredCache;
        if (parsedCache.sheetId === currentSheetId && parsedCache.data) {
          setSheetData(parsedCache.data);
          return;
        }
      }
    } catch (error) {
      console.error("Error reading from cache:", error);
      // Continue with fetching fresh data if cache read fails
    }
  }

  setIsLoading(true);
  setError(null);

  try {
    // Include session ID in the request
    const res = await apiRequest(
      "GET",
      `/api/smartsheet/${currentSheetId}?sessionId=${currentSessionId}`
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new SmartsheetError(
        errorData.error || "Failed to fetch sheet data",
        errorData
      );
    }

    const data = await res.json();

    // Update state
    setSheetData(data.data);
    const now = new Date();
    setLastUpdated(now);
    setCacheTimestamp(now);

    // Update cache if enabled
    if (cacheConfig.enabled) {
      try {
        const cacheData: StoredCache = {
          data: data.data,
          timestamp: now.toISOString(),
          sheetId: currentSheetId,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } catch (error) {
        console.error("Error writing to cache:", error);
      }
    }
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    setError(
      error instanceof SmartsheetError
        ? error
        : new SmartsheetError(
            error instanceof Error ? error.message : "Unknown error"
          )
    );
  } finally {
    setIsLoading(false);
  }
};
```

### 4.4 Update the Server-Side Sheet Data Route

```typescript
// server/routes/smartsheet.ts

// Get sheet information by ID
router.get("/:sheetId", async (req, res) => {
  try {
    const sheetId = req.params.sheetId;
    const sessionId = req.query.sessionId as string | undefined;

    if (!sheetId) {
      return res.status(400).json({
        success: false,
        error: "Sheet ID is required",
      });
    }

    // Validate session if provided
    if (sessionId) {
      try {
        // Import storage dynamically to avoid circular dependencies
        const { storage } = await import("../storage");
        const session = await storage.getSession(sessionId);

        if (session) {
          // Update session state if needed
          if (session.state === "INITIALIZING") {
            await storage.updateSessionState(sessionId, "ACTIVE");
          }
        }
      } catch (sessionError) {
        // Continue without session validation in development
        if (process.env.NODE_ENV === "production") {
          console.error("Error validating session:", sessionError);
        }
      }
    }

    // Use the environment variable for access token
    smartsheetTools.setAccessToken(process.env.SMARTSHEET_ACCESS_TOKEN || "");

    // Get actual sheet information from Smartsheet API
    const result = await smartsheetTools.getSheetInfo({ sheetId });

    res.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    // Error handling...
  }
});
```

## Step 5: Test and Verify

After implementing the changes, we'll test the sheet viewer to ensure it renders correctly:

1. **Visual Inspection**: Verify that the sheet viewer looks the same as it did before.
2. **Functionality Testing**: Test all features (sorting, filtering, etc.) to ensure they work correctly.
3. **Session Integration**: Verify that the session management updates are working correctly.

## Implementation Plan

1. **Backup Current Files**: Create backups of the current files before making changes.
2. **Implement Changes**: Apply the changes outlined above.
3. **Test in Development**: Test the changes in a development environment.
4. **Fix Any Issues**: Address any issues that arise during testing.
5. **Deploy**: Deploy the changes to production.

## Conclusion

By following this plan, we should be able to restore the sheet viewer to its previous working state while incorporating the necessary session management updates. The focus is on preserving the rendering functionality that worked before while making minimal changes to support the new session management system.
