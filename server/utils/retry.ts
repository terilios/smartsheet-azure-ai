import { type Result } from "./types";

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryableErrors?: (RegExp | string)[];
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
}

function isRetryableError(error: any, retryableErrors?: (RegExp | string)[]): boolean {
  if (!retryableErrors) return true;

  const errorMessage = error?.message || error?.toString() || '';
  return retryableErrors.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(errorMessage);
    }
    return errorMessage.includes(pattern);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<Result<T>> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryableErrors
  } = options;

  let lastError: any;
  let currentDelay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return { success: true, result };
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxAttempts || !isRetryableError(error, retryableErrors)) {
        break;
      }

      await delay(currentDelay);
      currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
    }
  }

  // Properly serialize the error before returning
  let errorMessage: string;
  if (lastError?.errorCode) {
    errorMessage = `Error ${lastError.errorCode}: ${lastError.message || 'Unknown error'}`;
  } else if (lastError?.statusCode) {
    errorMessage = `HTTP ${lastError.statusCode}: ${lastError.message || 'Unknown error'}`;
  } else if (lastError instanceof Error) {
    errorMessage = lastError.message;
  } else if (typeof lastError === 'object' && lastError !== null) {
    errorMessage = JSON.stringify(lastError);
  } else {
    errorMessage = String(lastError || 'Unknown error');
  }

  return {
    success: false,
    error: new Error(errorMessage)
  };
}

export class CircuitBreaker {
  private failures: number;
  private lastFailureTime: number | null;
  private state: 'closed' | 'open' | 'half-open';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000
  ) {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }

  private shouldReset(): boolean {
    if (this.state !== 'open') return false;
    if (!this.lastFailureTime) return false;

    const now = Date.now();
    return now - this.lastFailureTime >= this.resetTimeout;
  }

  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<Result<T>> {
    if (this.state === 'open') {
      if (this.shouldReset()) {
        this.state = 'half-open';
      } else {
        return {
          success: false,
          error: new Error('Circuit breaker is open')
        };
      }
    }

    try {
      const result = await withRetry(operation, options);
      
      if (result.success) {
        if (this.state === 'half-open') {
          this.state = 'closed';
          this.failures = 0;
          this.lastFailureTime = null;
        }
        return result;
      } else {
        this.handleFailure();
        return result;
      }
    } catch (error) {
      this.handleFailure();
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private handleFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    if (this.state === 'open' && this.shouldReset()) {
      return 'half-open';
    }
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed';
  }
}

// Create circuit breaker instances
export const smartsheetCircuitBreaker = new CircuitBreaker(5, 60000);
export const openaiCircuitBreaker = new CircuitBreaker(3, 30000);
