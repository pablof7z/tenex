import { watch } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
import * as path from 'node:path';
import { constants } from 'node:fs';

/**
 * Options for watching a file.
 */
export interface FileWatchOptions {
  /** Maximum time to wait in milliseconds */
  timeout?: number;
  /** Optional content that must be present in the file */
  content?: string;
}

/**
 * Efficiently waits for a file using file system watchers instead of polling.
 * This reduces CPU usage and provides faster response times.
 * 
 * @param filePath - Absolute path to the file to watch
 * @param options - Watch options
 * @returns Promise that resolves when the file exists (and contains required content)
 * @throws {Error} If timeout is reached or watcher fails
 * 
 * @example
 * ```typescript
 * await watchForFile('/path/to/file.txt', {
 *   timeout: 30000,
 *   content: 'expected text'
 * });
 * ```
 */
export async function watchForFile(
  filePath: string,
  options: FileWatchOptions = {}
): Promise<void> {
  const { timeout = 30000, content } = options;
  const dir = path.dirname(filePath);
  const filename = path.basename(filePath);
  
  return new Promise((resolve, reject) => {
    let watcher: ReturnType<typeof watch> | null = null;
    let timeoutId: Timer | null = null;
    let pollIntervalId: Timer | null = null;
    let resolved = false;
    
    const cleanup = () => {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    };
    
    const checkFile = async () => {
      try {
        const fileContent = await readFile(filePath, 'utf-8');
        if (!content || fileContent.includes(content)) {
          resolved = true;
          cleanup();
          resolve();
        }
      } catch (e) {
        // File doesn't exist yet or can't be read
      }
    };
    
    const setupWatcher = async () => {
      try {
        // Check if directory exists
        await access(dir, constants.F_OK);
        
        // Directory exists, set up watcher
        if (!watcher && !resolved) {
          watcher = watch(dir, (_eventType, changedFilename) => {
            // Only check if it's our file or if filename is null (some systems)
            if (!changedFilename || changedFilename === filename) {
              checkFile();
            }
          });
          
          watcher.on('error', (error) => {
            // If watcher fails, fall back to polling
            console.warn(`File watcher error, falling back to polling: ${error.message}`);
            watcher = null;
          });
        }
        
        // Stop polling once watcher is set up
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
      } catch (e) {
        // Directory doesn't exist yet, keep polling
      }
    };
    
    // Check immediately in case file already exists
    checkFile();
    
    if (!resolved) {
      // Set up timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for file: ${filePath}`));
      }, timeout);
      
      // Try to set up watcher immediately
      setupWatcher();
      
      // If directory doesn't exist, poll until it does
      if (!watcher) {
        pollIntervalId = setInterval(() => {
          checkFile(); // Check file in case it appeared
          setupWatcher(); // Try to set up watcher
        }, 500); // Poll every 500ms
      }
    }
  });
}