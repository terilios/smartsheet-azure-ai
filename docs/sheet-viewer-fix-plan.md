# Sheet Viewer Fix Plan

## Issue Overview

The sheet viewer component is not rendering after making changes related to session updates. Based on a review of the codebase, several potential issues have been identified that could be causing this problem.

## Potential Issues

1. **Session Management**: Changes to session updates may have affected how sheet data is loaded and managed.
2. **Data Flow**: The data flow between SmartsheetContainer and SheetViewer components may be disrupted.
3. **Error Handling**: Errors might not be properly caught or displayed.
4. **Session State**: Updates to session state management might affect session creation and data loading.
5. **Component Logic**: The SheetViewer component has complex logic that might fail if data is not properly provided.

## Diagnostic Steps

1. **Add Debug Logging**:

   - Add more detailed console logs in the SmartsheetContainer component to track the flow of data
   - Log the values of sheetData, isLoading, error, and sessionId at key points

2. **Check Session Creation**:

   - Verify that sessions are being created correctly
   - Ensure that the session ID is being stored and retrieved properly

3. **Inspect Network Requests**:

   - Monitor network requests to see if sheet data is being fetched
   - Check for any errors in the API responses

4. **Verify Context Values**:
   - Ensure that the SmartsheetContext is providing the expected values
   - Check that the useSmartsheet hook is working correctly

## Fix Implementation

### 1. Update SmartsheetContainer Component

```typescript
// In client/src/components/smartsheet/smartsheet-container.tsx

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
    currentSessionId, // Add this to track the session ID
  } = useSmartsheet();

  // Add debug logging
  console.log("SmartsheetContainer render:", {
    sheetId,
    currentSessionId,
    hasSheetData: !!sheetData,
    isLoading,
    hasError: !!error,
  });

  // Set the current sheet ID when the component mounts or sheetId changes
  useEffect(() => {
    console.log("Setting current sheet ID:", sheetId);
    setCurrentSheetId(sheetId);
  }, [sheetId, setCurrentSheetId]);

  // Early return to ensure hooks are called consistently when sheetData is null
  if (!error && !isLoading && !sheetData) {
    console.log("Early return: No sheet data, no error, not loading");
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

### 2. Update SmartsheetContext Provider

```typescript
// In client/src/lib/smartsheet-context.tsx

// Ensure session creation and data loading are properly synchronized
useEffect(() => {
  if (currentSheetId && currentSessionId) {
    console.log(
      "Refreshing sheet data for session:",
      currentSessionId,
      "sheet:",
      currentSheetId
    );
    refreshSheetData();
  } else {
    // Clear sheet data if no sheet ID or session ID
    console.log("Clearing sheet data - no sheet ID or session ID");
    setSheetData(null);
    setError(null);
  }
}, [currentSheetId, currentSessionId]);

// Modify refreshSheetData to handle session state
const refreshSheetData = async () => {
  if (!currentSheetId || !currentSessionId) {
    console.warn("Cannot refresh sheet data: No sheet ID or session ID");
    return;
  }

  setIsLoading(true);
  setError(null);

  try {
    console.log(
      `Fetching sheet data for sheet ID: ${currentSheetId}, session ID: ${currentSessionId}`
    );

    // Include session ID in the request
    const res = await apiRequest(
      "GET",
      `/api/smartsheet/${currentSheetId}?sessionId=${currentSessionId}`
    );

    if (!res.ok) {
      const errorData = await res.json();
      console.error("Error fetching sheet data:", errorData);
      throw new SmartsheetError(
        errorData.error || "Failed to fetch sheet data",
        errorData
      );
    }

    const data = await res.json();
    console.log("Sheet data received:", data);

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

### 3. Update SheetViewer Component

```typescript
// In client/src/components/smartsheet/sheet-viewer.tsx

export default function SheetViewer({
  data,
  isLoading,
  error,
  onRetry,
  showExtra = false,
  sessionId,
}: SheetViewerProps): JSX.Element {
  const { info } = useNotification();

  // Add more detailed logging
  console.log("SheetViewer render:", {
    isLoading,
    hasError: !!error,
    hasData: !!data,
    sessionId,
    dataDetails: data
      ? {
          sheetId: data.sheetId,
          sheetName: data.sheetName,
          columnCount: data.columns.length,
          rowCount: data.rows.length,
        }
      : null,
  });

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

  // Initialize columnWidths with a default value if data is null
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() =>
    data ? Object.fromEntries(data.columns.map((col) => [col.id, 200])) : {}
  );

  const [wrapText, setWrapText] = useState(true);

  // Update columnWidths when data changes
  useEffect(() => {
    if (data) {
      setColumnWidths((prev) => {
        const newWidths = { ...prev };
        data.columns.forEach((col) => {
          if (!newWidths[col.id]) {
            newWidths[col.id] = 200; // Default width
          }
        });
        return newWidths;
      });
    }
  }, [data]);

  // Rest of the component...

  // Ensure filteredRows and sortedRows handle null data
  const filteredRows = useMemo(() => {
    if (!data || !data.rows) return [];
    if (!searchTerm) return data.rows;
    return data.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data?.rows, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return [];
    if (!sortConfig.column) {
      return filteredRows;
    }
    // Rest of sorting logic...
  }, [filteredRows, sortConfig]);

  // Rest of the component...
}
```

### 4. Update Server-Side Session Handling

```typescript
// In server/routes/smartsheet.ts

// Ensure the route handler properly handles session IDs
router.get("/:sheetId", async (req, res) => {
  const { sheetId } = req.params;
  const { sessionId } = req.query;

  console.log(
    `Fetching sheet data for sheet ID: ${sheetId}, session ID: ${sessionId}`
  );

  try {
    // Validate session if provided
    if (sessionId) {
      const session = await storage.getSession(sessionId as string);
      if (!session) {
        console.warn(`Session not found: ${sessionId}`);
        // Continue without session validation in development
        if (process.env.NODE_ENV === "production") {
          return res.status(404).json({
            error: "Session not found",
            code: "SESSION_NOT_FOUND",
          });
        }
      } else {
        console.log(`Session found: ${sessionId}, state: ${session.state}`);
        // Update session state if needed
        if (session.state === "INITIALIZING") {
          await storage.updateSessionState(sessionId as string, "ACTIVE");
        }
      }
    }

    // Fetch sheet data
    // Rest of the handler...
  } catch (error) {
    // Error handling...
  }
});
```

## Testing Plan

1. **Verify Session Creation**:

   - Check that sessions are being created with the correct state
   - Verify that the session ID is being stored in localStorage

2. **Test Data Loading**:

   - Monitor network requests to ensure sheet data is being fetched
   - Verify that the sheet data is being passed to the SheetViewer component

3. **Check Component Rendering**:

   - Ensure that the SheetViewer component is rendering with the correct props
   - Verify that the component handles null or undefined data gracefully

4. **Test Error Handling**:
   - Simulate error conditions to ensure they are properly caught and displayed
   - Verify that the user can retry loading the sheet data

## Implementation Steps

1. **Add Debug Logging**:

   - Add console logs to track data flow and component rendering
   - Use browser developer tools to monitor network requests and component state

2. **Update SmartsheetContainer**:

   - Modify the component to pass the session ID to SheetViewer
   - Ensure proper error handling and loading states

3. **Update SmartsheetContext**:

   - Ensure session creation and data loading are properly synchronized
   - Add more robust error handling

4. **Update SheetViewer**:

   - Ensure the component handles null or undefined data gracefully
   - Add defensive checks for data properties

5. **Test and Verify**:
   - Test the changes in development environment
   - Verify that the sheet viewer renders correctly

## Conclusion

By implementing these changes, we should be able to fix the sheet viewer rendering issue while maintaining compatibility with the session updates. The key is to ensure proper synchronization between session creation, data loading, and component rendering, with robust error handling at each step.
