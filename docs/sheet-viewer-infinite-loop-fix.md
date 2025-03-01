# Sheet Viewer Infinite Loop Fix

## Issue

The sheet viewer was experiencing a "Too many re-renders" error due to an infinite loop in the React component rendering cycle. This was causing the application to crash with the following error:

```
Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.
```

## Root Cause

The infinite loop was occurring in the `SmartsheetFrame` component due to the following issues:

1. **Session Management Loop**: The component was calling `setCurrentSessionId` inside a useEffect hook that had `currentSessionId` as a dependency. This created a cycle where:

   - The component renders with `currentSessionId` as null
   - The useEffect runs and calls `setCurrentSessionId` with a new session ID
   - This causes `currentSessionId` to change
   - The change in `currentSessionId` triggers the useEffect again
   - The cycle repeats, causing too many re-renders

2. **Improper SheetViewer Usage**: The `SmartsheetFrame` component was using the `SheetViewer` component without providing the required props (`data`, `isLoading`, `error`), which are expected by the `SheetViewer` component.

## Solution

### 1. Fix Session Management Loop

To fix the session management loop, we added a ref to track whether we've already attempted to create a session, and removed `currentSessionId` from the dependency array:

```typescript
const sessionAttemptedRef = useRef<boolean>(false);

useEffect(() => {
  async function ensureSession() {
    // Prevent infinite loop by only attempting to create a session once
    if (sessionAttemptedRef.current) {
      setLoading(false);
      return;
    }

    sessionAttemptedRef.current = true;

    try {
      // If there's no session id, validate (which will create one if missing)
      if (!currentSessionId) {
        const valid = await validateSession();
        if (!valid) {
          // Try to recreate session if not valid
          const newSession = await recreateSession();
          if (newSession) {
            setCurrentSessionId(newSession);
          } else {
            setError("Failed to create a valid session.");
          }
        }
      }
    } catch (err) {
      console.error("Error ensuring session:", err);
      setError("Error ensuring session.");
    } finally {
      setLoading(false);
    }
  }
  ensureSession();
}, [validateSession, recreateSession, setCurrentSessionId]); // Removed currentSessionId from dependencies
```

### 2. Fix SheetViewer Usage

To fix the SheetViewer usage, we properly passed the required props from the SmartsheetContext:

```typescript
// Get sheet data from the context
const {
  sheetData,
  isLoading: sheetLoading,
  error: sheetError,
  refreshSheetData,
} = useSmartsheet();

// Create a proper SheetError object if we have an error string
const errorObj = error
  ? (Object.assign(new Error(error), { name: "SessionError" }) as SheetError)
  : null;

return (
  <div className="h-full">
    <SheetViewer
      data={sheetData || undefined}
      isLoading={loading || sheetLoading}
      error={sheetError || errorObj}
      onRetry={refreshSheetData}
      sessionId={currentSessionId}
    />
  </div>
);
```

### 3. Import Required Types

We also added the necessary import for the SheetError type:

```typescript
import { type SheetError } from "@/lib/types";
```

## Results

These changes fixed the infinite loop issue by:

1. Preventing the session validation from running in an infinite loop
2. Properly providing the required props to the SheetViewer component
3. Ensuring type safety with proper error object creation

The sheet viewer now renders correctly without causing too many re-renders.
