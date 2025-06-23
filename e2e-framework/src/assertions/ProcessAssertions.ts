import { ProcessHandle } from '../ProcessController';
import { getConfig } from '../config';
import { TestError } from '../types';

export async function assertProcessOutput(
  handle: ProcessHandle,
  expected: string,
  options: { 
    stream?: 'stdout' | 'stderr';
    timeout?: number;
    caseSensitive?: boolean;
  } = {}
): Promise<string> {
  const config = getConfig();
  const { stream = 'stdout', timeout = config.timeouts.default, caseSensitive = false } = options;
  const iterator = stream === 'stdout' ? handle.stdout : handle.stderr;
  
  const startTime = Date.now();
  
  for await (const line of iterator) {
    const content = caseSensitive ? line : line.toLowerCase();
    const searchTerm = caseSensitive ? expected : expected.toLowerCase();
    
    if (content.includes(searchTerm)) {
      return line;
    }
    
    if (Date.now() - startTime > timeout) {
      throw new TestError(
        `Process ${stream} did not contain "${expected}" within ${timeout}ms`,
        {
          step: 'assertProcessOutput'
        }
      );
    }
  }
  
  throw new TestError(
    `Process ${stream} ended without containing "${expected}"`,
    {
      step: 'assertProcessOutput'
    }
  );
}

export async function assertProcessExits(
  handle: ProcessHandle,
  expectedCode: number = 0,
  timeout?: number
): Promise<void> {
  const config = getConfig();
  const actualTimeout = timeout ?? config.timeouts.processExit;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TestError(
        `Process did not exit within ${actualTimeout}ms`,
        {
          step: 'assertProcessExits'
        }
      ));
    }, actualTimeout);
    
    handle.process.on('exit', (code) => {
      clearTimeout(timeoutId);
      if (code !== expectedCode) {
        reject(new TestError(
          `Process exited with code ${code}, expected ${expectedCode}`,
          {
            step: 'assertProcessExits'
          }
        ));
      } else {
        resolve();
      }
    });
  });
}

export async function collectProcessOutput(
  handle: ProcessHandle,
  options: {
    stream?: 'stdout' | 'stderr' | 'both';
    maxLines?: number;
    timeout?: number;
  } = {}
): Promise<string[]> {
  const config = getConfig();
  const { stream = 'both', maxLines = 1000, timeout = config.timeouts.default } = options;
  const lines: string[] = [];
  const startTime = Date.now();
  
  const collectFromStream = async (iterator: AsyncIterableIterator<string>) => {
    for await (const line of iterator) {
      lines.push(line);
      if (lines.length >= maxLines) break;
      if (Date.now() - startTime > timeout) break;
    }
  };
  
  if (stream === 'stdout' || stream === 'both') {
    await collectFromStream(handle.stdout);
  }
  
  if (stream === 'stderr' || stream === 'both') {
    await collectFromStream(handle.stderr);
  }
  
  return lines;
}

export function assertProcessRunning(handle: ProcessHandle): void {
  if (handle.process.killed) {
    throw new TestError(
      'Process has been killed',
      {
        step: 'assertProcessRunning'
      }
    );
  }
  
  if (handle.process.exitCode !== null) {
    throw new TestError(
      `Process has exited with code ${handle.process.exitCode}`,
      {
        step: 'assertProcessRunning'
      }
    );
  }
}

export async function assertProcessOutputPattern(
  handle: ProcessHandle,
  pattern: RegExp,
  options: {
    stream?: 'stdout' | 'stderr';
    timeout?: number;
  } = {}
): Promise<string> {
  const config = getConfig();
  const { stream = 'stdout', timeout = config.timeouts.default } = options;
  const iterator = stream === 'stdout' ? handle.stdout : handle.stderr;
  
  const startTime = Date.now();
  
  for await (const line of iterator) {
    if (pattern.test(line)) {
      return line;
    }
    
    if (Date.now() - startTime > timeout) {
      throw new TestError(
        `Process ${stream} did not match pattern ${pattern} within ${timeout}ms`,
        {
          step: 'assertProcessOutputPattern'
        }
      );
    }
  }
  
  throw new TestError(
    `Process ${stream} ended without matching pattern ${pattern}`,
    {
      step: 'assertProcessOutputPattern'
    }
  );
}