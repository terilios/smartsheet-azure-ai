/// <reference types="jest" />

import { withRetry, CircuitBreaker } from './retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return successful result on first try', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await withRetry(operation);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed eventually', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const resultPromise = withRetry(operation, { maxAttempts: 3 });
    
    // Run all timers after each rejection
    await jest.runAllTimersAsync();
    await jest.runAllTimersAsync();
    
    const result = await resultPromise;

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should respect maxAttempts and fail after all retries', async () => {
    const error = new Error('Network error');
    const operation = jest.fn().mockRejectedValue(error);

    const resultPromise = withRetry(operation, { maxAttempts: 3 });
    
    // Run all timers for each retry attempt
    await jest.runAllTimersAsync();
    await jest.runAllTimersAsync();
    
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable errors', async () => {
    const error = new Error('Invalid input');
    const operation = jest.fn().mockRejectedValue(error);

    const result = await withRetry(operation, {
      retryableErrors: [/network/i, /timeout/i],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let now: number;

  beforeEach(() => {
    jest.useFakeTimers();
    now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    circuitBreaker = new CircuitBreaker(2, 5000); // 2 failures, 5s timeout
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should allow operations when closed', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(operation);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should open after failure threshold', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('error'));

    // First failure
    await circuitBreaker.execute(operation);
    expect(circuitBreaker.getState()).toBe('closed');

    // Second failure - should open circuit
    await circuitBreaker.execute(operation);
    expect(circuitBreaker.getState()).toBe('open');

    // Should reject immediately without calling operation
    const result = await circuitBreaker.execute(operation);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Circuit breaker is open');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should transition to half-open after timeout', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('error'));

    // Open the circuit
    await circuitBreaker.execute(operation);
    await circuitBreaker.execute(operation);
    expect(circuitBreaker.getState()).toBe('open');

    // Advance time past reset timeout
    now += 5001; // Just over 5 seconds
    
    // Verify state transition
    expect(circuitBreaker.getState()).toBe('half-open');

    // Test successful operation closes the circuit
    const successOp = jest.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(successOp);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(circuitBreaker.getState()).toBe('closed');
  });

  it('should reset failure count after successful operation', async () => {
    const failOp = jest.fn().mockRejectedValue(new Error('error'));
    const successOp = jest.fn().mockResolvedValue('success');

    // One failure
    await circuitBreaker.execute(failOp);
    expect(circuitBreaker.getFailures()).toBe(1);

    // Success should reset count
    await circuitBreaker.execute(successOp);
    expect(circuitBreaker.getFailures()).toBe(0);
  });
});
