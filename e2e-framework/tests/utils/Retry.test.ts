import { describe, test, expect, beforeEach } from 'bun:test';
import { retry, defaultIsRetryable, WithRetry } from '../../src/utils/Retry';
import { Logger } from '../../src/utils/Logger';

describe('Retry', () => {
  describe('retry function', () => {
    test('should return result on first success', async () => {
      let attempts = 0;
      const result = await retry(async () => {
        attempts++;
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });
    
    test('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const result = await retry(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('temporary failure');
        }
        return 'success after retries';
      }, {
        maxAttempts: 5,
        initialDelay: 10 // Fast for tests
      });
      
      expect(result).toBe('success after retries');
      expect(attempts).toBe(3);
    });
    
    test('should throw after max attempts', async () => {
      let attempts = 0;
      const promise = retry(async () => {
        attempts++;
        throw new Error('temporary failure');
      }, {
        maxAttempts: 3,
        initialDelay: 10,
        isRetryable: () => true // Always retry to test max attempts
      });
      
      await expect(promise).rejects.toThrow('temporary failure');
      expect(attempts).toBe(3);
    });
    
    test('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const promise = retry(async () => {
        attempts++;
        throw new Error('fatal error');
      }, {
        maxAttempts: 5,
        initialDelay: 10,
        isRetryable: (error) => false
      });
      
      await expect(promise).rejects.toThrow('fatal error');
      expect(attempts).toBe(1);
    });
    
    test('should use exponential backoff', async () => {
      let attempts = 0;
      const attemptTimes: number[] = [];
      
      const promise = retry(async () => {
        attempts++;
        attemptTimes.push(Date.now());
        throw new Error('failure');
      }, {
        maxAttempts: 4,
        initialDelay: 50,
        backoffMultiplier: 2,
        isRetryable: () => true
      });
      
      await expect(promise).rejects.toThrow();
      expect(attempts).toBe(4);
      
      // Calculate delays between attempts
      const delays: number[] = [];
      for (let i = 1; i < attemptTimes.length; i++) {
        delays.push(attemptTimes[i] - attemptTimes[i - 1]);
      }
      
      // Check that delays roughly follow exponential pattern
      expect(delays.length).toBe(3);
      expect(delays[0]).toBeGreaterThanOrEqual(40); // ~50ms (with some tolerance)
      expect(delays[0]).toBeLessThanOrEqual(70);
      expect(delays[1]).toBeGreaterThanOrEqual(80); // ~100ms
      expect(delays[1]).toBeLessThanOrEqual(130);
      expect(delays[2]).toBeGreaterThanOrEqual(170); // ~200ms
      expect(delays[2]).toBeLessThanOrEqual(230);
    });
    
    test('should respect max delay', async () => {
      let attempts = 0;
      const attemptTimes: number[] = [];
      
      const promise = retry(async () => {
        attempts++;
        attemptTimes.push(Date.now());
        throw new Error('failure');
      }, {
        maxAttempts: 4,
        initialDelay: 50,
        maxDelay: 100,
        backoffMultiplier: 10, // Would exceed maxDelay
        isRetryable: () => true
      });
      
      await expect(promise).rejects.toThrow();
      expect(attempts).toBe(4);
      
      // Calculate delays between attempts
      const delays: number[] = [];
      for (let i = 1; i < attemptTimes.length; i++) {
        delays.push(attemptTimes[i] - attemptTimes[i - 1]);
      }
      
      // All delays should be capped at maxDelay
      expect(delays.length).toBe(3);
      // First delay should be ~50ms
      expect(delays[0]).toBeGreaterThanOrEqual(40);
      expect(delays[0]).toBeLessThanOrEqual(70);
      // Subsequent delays should be capped at maxDelay (100ms)
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).toBeLessThanOrEqual(120); // maxDelay + small tolerance
      }
    });
  });
  
  describe('defaultIsRetryable', () => {
    test('should identify network errors as retryable', () => {
      expect(defaultIsRetryable(new Error('Network error'))).toBe(true);
      expect(defaultIsRetryable(new Error('Connection refused'))).toBe(true);
      expect(defaultIsRetryable(new Error('ECONNREFUSED'))).toBe(true);
      expect(defaultIsRetryable(new Error('Timeout waiting for response'))).toBe(true);
    });
    
    test('should identify temporary failures as retryable', () => {
      expect(defaultIsRetryable(new Error('Temporary failure'))).toBe(true);
      expect(defaultIsRetryable(new Error('Please try again later'))).toBe(true);
      expect(defaultIsRetryable(new Error('Transient error occurred'))).toBe(true);
    });
    
    test('should identify file not found as retryable', () => {
      expect(defaultIsRetryable(new Error('ENOENT: no such file or directory'))).toBe(true);
    });
    
    test('should not identify other errors as retryable', () => {
      expect(defaultIsRetryable(new Error('Invalid argument'))).toBe(false);
      expect(defaultIsRetryable(new Error('Permission denied'))).toBe(false);
      expect(defaultIsRetryable(new Error('Syntax error'))).toBe(false);
    });
  });
  
  describe('WithRetry decorator', () => {
    class TestService {
      attempts = 0;
      
      @WithRetry({ maxAttempts: 3, initialDelay: 10 })
      async flakeyMethod(): Promise<string> {
        this.attempts++;
        if (this.attempts < 2) {
          throw new Error('temporary failure');
        }
        return 'success';
      }
      
      @WithRetry({ maxAttempts: 2, initialDelay: 10, isRetryable: () => false })
      async nonRetryableMethod(): Promise<string> {
        this.attempts++;
        throw new Error('permanent failure');
      }
    }
    
    test('should retry decorated methods', async () => {
      const service = new TestService();
      const result = await service.flakeyMethod();
      
      expect(result).toBe('success');
      expect(service.attempts).toBe(2);
    });
    
    test('should respect decorator options', async () => {
      const service = new TestService();
      const promise = service.nonRetryableMethod();
      
      await expect(promise).rejects.toThrow('permanent failure');
      expect(service.attempts).toBe(1);
    });
  });
});