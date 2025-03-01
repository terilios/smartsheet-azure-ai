# Sheet Viewer Hooks Fix

## Issue

After fixing the infinite loop issue in the SmartsheetFrame component, we encountered another React hooks error:

```
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

This error occurs when the number of hooks called changes between renders, which violates the Rules of Hooks in React.

## Root Cause

The issue was in the SheetViewer component, where we had:

1. **Conditional Hook Calls**: The component was defining and using hooks (useMemo for filteredRows and sortedRows) after conditional early returns, which violates React's rules of hooks.

2. **Duplicate Declarations**: The component had duplicate declarations of the filteredRows and sortedRows variables, with one set defined before the early returns and another set defined after the early returns.

## Solution

### 1. Move All Hooks Before Early Returns

We moved all hook calls (useState, useEffect, useCallback, useMemo) to the top of the component, before any conditional returns:

```typescript
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

  // Effects and callbacks
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

  // Define filteredRows and sortedRows regardless of data state
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

  // Early returns after all hooks are defined
  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    console.error("SheetViewer error:", error);
    return (
      <ErrorState error={error} onRetry={onRetry} onRetryClick={handleRetry} />
    );
  }

  if (!data) {
    console.warn("SheetViewer: No data available");
    return <EmptyState onConfigure={handleConfigure} />;
  }

  // Rest of the component...
}
```

### 2. Remove Duplicate Declarations

We removed the duplicate declarations of filteredRows and sortedRows that were defined after the early returns:

```typescript
// REMOVED:
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
```

### 3. Add Defensive Checks

We added defensive checks to ensure that the component can handle null or undefined data:

```typescript
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
```

## Results

These changes fixed the hooks error by:

1. Ensuring that all hooks are called unconditionally at the top of the component
2. Removing duplicate declarations that could cause confusion
3. Adding defensive checks to handle null or undefined data

The sheet viewer now renders correctly without any hooks errors.
