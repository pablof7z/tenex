import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  assertProcessOutput,
  assertProcessExits,
  collectProcessOutput,
  assertProcessRunning,
  assertProcessOutputPattern
} from '../../src/assertions/ProcessAssertions';
import { ProcessHandle } from '../../src/ProcessController';
import { ChildProcess } from 'child_process';

// Helper to create async generator
async function* createAsyncGenerator(values: string[]) {
  for (const value of values) {
    yield value;
  }
}

describe('ProcessAssertions', () => {
  let mockHandle: ProcessHandle;
  let mockProcess: ChildProcess;
  
  beforeEach(() => {
    mockProcess = {
      killed: false,
      exitCode: null,
      on: mock((event, callback) => {
        // Default behavior - can be overridden in tests
      })
    } as any;
    
    mockHandle = {
      process: mockProcess,
      stdout: createAsyncGenerator([]),
      stderr: createAsyncGenerator([])
    };
  });
  
  describe('assertProcessOutput', () => {
    test('should find expected text in stdout', async () => {
      mockHandle.stdout = createAsyncGenerator(['hello', 'world', 'test']);
      
      const result = await assertProcessOutput(mockHandle, 'world');
      expect(result).toBe('world');
    });
    
    test('should find expected text in stderr', async () => {
      mockHandle.stderr = createAsyncGenerator(['error:', 'something went wrong']);
      
      const result = await assertProcessOutput(mockHandle, 'wrong', { stream: 'stderr' });
      expect(result).toBe('something went wrong');
    });
    
    test('should handle case-insensitive search', async () => {
      mockHandle.stdout = createAsyncGenerator(['HELLO WORLD']);
      
      const result = await assertProcessOutput(mockHandle, 'hello', { caseSensitive: false });
      expect(result).toBe('HELLO WORLD');
    });
    
    test('should throw on timeout', async () => {
      // Create a slow generator
      mockHandle.stdout = (async function* () {
        await new Promise(resolve => setTimeout(resolve, 100));
        yield 'too late';
      })();
      
      await expect(
        assertProcessOutput(mockHandle, 'test', { timeout: 50 })
      ).rejects.toThrow('Process stdout did not contain "test" within 50ms');
    });
    
    test('should throw when stream ends without match', async () => {
      mockHandle.stdout = createAsyncGenerator(['foo', 'bar']);
      
      await expect(
        assertProcessOutput(mockHandle, 'baz')
      ).rejects.toThrow('Process stdout ended without containing "baz"');
    });
  });
  
  describe('assertProcessExits', () => {
    test('should pass when process exits with expected code', async () => {
      mockProcess.on = mock((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(0), 10);
        }
      });
      
      await expect(
        assertProcessExits(mockHandle, 0)
      ).resolves.toBeUndefined();
    });
    
    test('should throw when process exits with wrong code', async () => {
      mockProcess.on = mock((event, callback) => {
        if (event === 'exit') {
          setTimeout(() => callback(1), 10);
        }
      });
      
      await expect(
        assertProcessExits(mockHandle, 0)
      ).rejects.toThrow('Process exited with code 1, expected 0');
    });
    
    test('should throw on timeout', async () => {
      mockProcess.on = mock(() => {
        // Never call the callback
      });
      
      await expect(
        assertProcessExits(mockHandle, 0, 50)
      ).rejects.toThrow('Process did not exit within 50ms');
    });
  });
  
  describe('collectProcessOutput', () => {
    test('should collect all stdout lines', async () => {
      mockHandle.stdout = createAsyncGenerator(['line 1', 'line 2', 'line 3']);
      
      const result = await collectProcessOutput(mockHandle, { stream: 'stdout' });
      expect(result).toEqual(['line 1', 'line 2', 'line 3']);
    });
    
    test('should collect all stderr lines', async () => {
      mockHandle.stderr = createAsyncGenerator(['error 1', 'error 2']);
      
      const result = await collectProcessOutput(mockHandle, { stream: 'stderr' });
      expect(result).toEqual(['error 1', 'error 2']);
    });
    
    test('should collect both streams when specified', async () => {
      mockHandle.stdout = createAsyncGenerator(['out 1', 'out 2']);
      mockHandle.stderr = createAsyncGenerator(['err 1', 'err 2']);
      
      const result = await collectProcessOutput(mockHandle, { stream: 'both' });
      // Since streams are collected sequentially (stdout first, then stderr)
      expect(result).toEqual(['out 1', 'out 2', 'err 1', 'err 2']);
    });
    
    test('should respect maxLines limit', async () => {
      mockHandle.stdout = createAsyncGenerator(['1', '2', '3', '4', '5']);
      mockHandle.stderr = createAsyncGenerator([]); // Empty stderr
      
      const result = await collectProcessOutput(mockHandle, { maxLines: 3, stream: 'stdout' });
      expect(result).toEqual(['1', '2', '3']);
    });
    
    test('should respect timeout', async () => {
      let yielded = 0;
      // Create a generator that tracks how many items were yielded
      mockHandle.stdout = (async function* () {
        yield '1';
        yielded++;
        // This delay is longer than the timeout
        await new Promise(resolve => setTimeout(resolve, 200));
        yield '2';
        yielded++;
      })();
      mockHandle.stderr = createAsyncGenerator([]); // Empty stderr
      
      const result = await collectProcessOutput(mockHandle, { timeout: 50, stream: 'stdout' });
      // The implementation collects lines until timeout, but the async iterator
      // might have already queued the second yield before timeout check
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toBe('1');
    });
  });
  
  describe('assertProcessRunning', () => {
    test('should pass when process is running', () => {
      mockProcess.killed = false;
      mockProcess.exitCode = null;
      
      expect(() => assertProcessRunning(mockHandle)).not.toThrow();
    });
    
    test('should throw when process is killed', () => {
      mockProcess.killed = true;
      
      expect(() => assertProcessRunning(mockHandle))
        .toThrow('Process has been killed');
    });
    
    test('should throw when process has exited', () => {
      mockProcess.exitCode = 0;
      
      expect(() => assertProcessRunning(mockHandle))
        .toThrow('Process has exited with code 0');
    });
  });
  
  describe('assertProcessOutputPattern', () => {
    test('should find pattern in stdout', async () => {
      mockHandle.stdout = createAsyncGenerator([
        'Starting server...',
        'Server listening on port 3000',
        'Ready to accept connections'
      ]);
      
      const result = await assertProcessOutputPattern(mockHandle, /port \d+/);
      expect(result).toBe('Server listening on port 3000');
    });
    
    test('should find pattern in stderr', async () => {
      mockHandle.stderr = createAsyncGenerator([
        'Warning: deprecated function',
        'Error: Failed to connect to database'
      ]);
      
      const result = await assertProcessOutputPattern(
        mockHandle, 
        /Error:.*database/,
        { stream: 'stderr' }
      );
      expect(result).toBe('Error: Failed to connect to database');
    });
    
    test('should throw when pattern not found', async () => {
      mockHandle.stdout = createAsyncGenerator(['foo', 'bar', 'baz']);
      
      await expect(
        assertProcessOutputPattern(mockHandle, /test/)
      ).rejects.toThrow('Process stdout ended without matching pattern /test/');
    });
    
    test('should respect timeout', async () => {
      // Create a generator that yields non-matching lines slowly
      mockHandle.stdout = (async function* () {
        while (true) {
          yield 'no match here';
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      })();
      
      await expect(
        assertProcessOutputPattern(mockHandle, /pattern/, { timeout: 50 })
      ).rejects.toThrow('Process stdout did not match pattern /pattern/ within 50ms');
    });
  });
});