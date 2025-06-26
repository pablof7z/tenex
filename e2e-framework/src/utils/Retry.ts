import { Logger } from './Logger';

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay between retries in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay between retries in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable (default: always retry) */
  isRetryable?: (error: Error) => boolean;
  /** Logger instance for logging retry attempts */
  logger?: Logger;
}

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  /** The successful result (if any) */
  result?: T;
  /** The final error (if all retries failed) */
  error?: Error;
  /** Number of attempts made */
  attempts: number;
  /** Whether the operation eventually succeeded */
  success: boolean;
}

/**
 * Default function to check if an error is retryable.
 * Network errors, timeouts, and temporary failures are retryable.
 */
export function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network-related errors
  if (message.includes('network') || 
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')) {
    return true;
  }
  
  // Temporary failures
  if (message.includes('temporary') ||
      message.includes('transient') ||
      message.includes('try again')) {
    return true;
  }
  
  // File system race conditions
  if (message.includes('enoent') && message.includes('no such file')) {
    return true;
  }
  
  return false;
}

/**
 * Executes a function with automatic retry on failure.
 * Uses exponential backoff between retries.
 * 
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws {Error} The last error if all retries fail
 * 
 * @example
 * ```typescript
 * // Simple retry with defaults
 * const result = await retry(async () => {
 *   return await fetchDataFromAPI();
 * });
 * 
 * // Custom retry configuration
 * const result = await retry(
 *   async () => await connectToServer(),
 *   {
 *     maxAttempts: 5,
 *     initialDelay: 2000,
 *     isRetryable: (error) => error.message.includes('connection')
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    isRetryable = defaultIsRetryable,
    logger
  } = options;
  
  let lastError: Error | null = null;
  let delay = initialDelay;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger?.debug(`Attempt ${attempt}/${maxAttempts}`, { fn: fn.name || 'anonymous' });
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      if (attempt === maxAttempts || !isRetryable(lastError)) {
        logger?.error(`Failed after ${attempt} attempts`, {
          error: lastError.message,
          retryable: false
        });
        throw lastError;
      }
      
      // Log retry attempt
      logger?.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        nextDelay: delay
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed with no error');
}

/**
 * Decorator for adding retry behavior to class methods.
 * 
 * @param options - Retry configuration options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @WithRetry({ maxAttempts: 5 })
 *   async fetchData(): Promise<Data> {
 *     return await this.api.getData();
 *   }
 * }
 * ```
 */
export function WithRetry(options: RetryOptions = {}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };
    
    return descriptor;
  };
}