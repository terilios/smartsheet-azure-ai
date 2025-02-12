# Developer Guide

## Error Handling & Recovery

### Retry Mechanism

The application implements a robust retry mechanism for handling transient failures in external API calls. This is implemented in `server/utils/retry.ts`.

```typescript
// Example usage with retry
const result = await withRetry(async () => someApiCall(), {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
});
```

Key features:

- Exponential backoff with configurable parameters
- Customizable retry conditions
- Detailed error tracking and reporting
- Maximum retry attempts to prevent infinite loops

### Circuit Breaker Pattern

The application uses the Circuit Breaker pattern to prevent cascading failures and provide fault tolerance:

```typescript
// Example usage with circuit breaker
const result = await circuitBreaker.execute(async () => someApiCall(), {
  maxAttempts: 3,
  retryableErrors: [/rate limit/i, /timeout/i],
});
```

States:

- Closed: Normal operation, requests pass through
- Open: Failing state, requests are blocked
- Half-Open: Testing state, limited requests allowed

### Retryable Errors

The following errors are automatically retried:

- Network timeouts
- Rate limiting responses
- Connection resets
- Temporary service unavailability
- Socket hangups

### Error Recovery

1. API Failures

   - Automatic retry with exponential backoff
   - Circuit breaker protection
   - Fallback to cached data when possible

2. WebSocket Disconnections

   - Automatic reconnection attempts
   - Event queue for missed updates
   - State synchronization on reconnect

3. Cache Invalidation
   - TTL-based expiration
   - Version tracking
   - Incremental updates

## Real-time Updates

### WebSocket Implementation

The application uses WebSocket for real-time updates:

1. Server-side (`server/services/websocket.ts`)

   - Connection management
   - Event broadcasting
   - Session tracking

2. Client-side (`client/src/hooks/use-sheet-updates.ts`)
   - Automatic reconnection
   - Event handling
   - UI updates

### Smartsheet Webhooks

Webhook integration provides real-time sheet updates:

1. Setup

   - Webhook registration
   - Signature verification
   - Event filtering

2. Event Processing
   - Update broadcasting
   - Cache invalidation
   - Client notification

## In-line Editing

### EditableCell Component

The `EditableCell` component (`client/src/components/smartsheet/editable-cell.tsx`) provides:

1. Features

   - Type-specific editors
   - Validation feedback
   - Auto-save functionality
   - Real-time updates

2. Supported Types
   - Text/Number
   - Date
   - Checkbox
   - Picklist

### Edit Flow

1. User Interaction

   - Double-click to edit
   - Type-specific input
   - Validation feedback

2. Save Process
   - Optimistic updates
   - Error handling
   - Real-time sync

## Best Practices

### Error Handling

1. Always use the retry utilities for external API calls:

```typescript
const result = await withRetry(async () => api.call(), { maxAttempts: 3 });
```

2. Implement circuit breakers for critical services:

```typescript
const circuitBreaker = new CircuitBreaker(5, 60000);
const result = await circuitBreaker.execute(operation);
```

3. Provide meaningful error messages:

```typescript
throw new Error(`Failed to update sheet: ${error.message}`);
```

### Real-time Updates

1. Subscribe to updates:

```typescript
useSheetUpdates(sheetId);
```

2. Handle WebSocket events:

```typescript
ws.addEventListener("message", handleUpdate);
```

3. Implement reconnection logic:

```typescript
const connect = () => {
  ws.addEventListener("close", () => {
    setTimeout(connect, 5000);
  });
};
```

### Performance

1. Use caching effectively:

```typescript
const cachedData = sheetCache.get(sheetId);
if (cachedData) return cachedData;
```

2. Implement incremental updates:

```typescript
const updates = await getModifiedRows(lastSync);
mergeUpdates(existingData, updates);
```

3. Optimize re-renders:

```typescript
const memoizedValue = useMemo(() => compute(value), [value]);
```

## Configuration

### Environment Variables

Required variables:

```env
SMARTSHEET_ACCESS_TOKEN=your_token
SMARTSHEET_WEBHOOK_SECRET=your_secret
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_API_BASE=your_base_url
AZURE_OPENAI_DEPLOYMENT=your_deployment
```

### Circuit Breaker Configuration

Default settings:

```typescript
{
  failureThreshold: 5,
  resetTimeout: 60000,
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000
}
```

### Retry Configuration

Default settings:

```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
}
```

## Testing

### Unit Tests

1. Test retry mechanism:

```typescript
test("should retry failed operations", async () => {
  const operation = jest
    .fn()
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValueOnce("success");

  const result = await withRetry(operation);
  expect(result.success).toBe(true);
  expect(operation).toHaveBeenCalledTimes(2);
});
```

2. Test circuit breaker:

```typescript
test("should open circuit after failures", async () => {
  const breaker = new CircuitBreaker(2, 1000);
  const operation = jest.fn().mockRejectedValue(new Error());

  await breaker.execute(operation);
  await breaker.execute(operation);

  expect(breaker.getState()).toBe("open");
});
```

### Integration Tests

1. Test WebSocket connections:

```typescript
test("should reconnect on disconnection", async () => {
  const ws = new WebSocket(url);
  await waitForConnect(ws);
  server.close();
  await waitForReconnect(ws);
  expect(ws.readyState).toBe(WebSocket.OPEN);
});
```

2. Test real-time updates:

```typescript
test("should receive sheet updates", async () => {
  const { result } = renderHook(() => useSheetUpdates(sheetId));
  await updateSheet(sheetId);
  expect(result.current.lastUpdate).toBeDefined();
});
```
