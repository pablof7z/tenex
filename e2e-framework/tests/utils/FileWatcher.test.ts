import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { watchForFile } from '../../src/utils/FileWatcher';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('FileWatcher', () => {
  let testDir: string;
  let testFile: string;
  
  beforeEach(async () => {
    testDir = path.join(tmpdir(), `filewatcher-test-${Date.now()}`);
    testFile = path.join(testDir, 'test.txt');
    await mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });
  
  test('should resolve immediately if file already exists', async () => {
    await writeFile(testFile, 'hello world');
    
    const start = Date.now();
    await watchForFile(testFile);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(50); // Should be nearly instant
  });
  
  test('should wait for file to be created', async () => {
    const watchPromise = watchForFile(testFile, { timeout: 5000 });
    
    // Create file after a delay
    setTimeout(() => {
      writeFile(testFile, 'created');
    }, 100);
    
    await expect(watchPromise).resolves.toBeUndefined();
  });
  
  test('should wait for file with specific content', async () => {
    await writeFile(testFile, 'initial content');
    
    const watchPromise = watchForFile(testFile, {
      content: 'expected text',
      timeout: 5000
    });
    
    // Update file with expected content after delay
    setTimeout(() => {
      writeFile(testFile, 'here is the expected text!');
    }, 100);
    
    await expect(watchPromise).resolves.toBeUndefined();
  });
  
  test('should timeout if file never appears', async () => {
    const watchPromise = watchForFile(testFile, { timeout: 100 });
    
    await expect(watchPromise).rejects.toThrow('Timeout waiting for file');
  });
  
  test('should timeout if content never matches', async () => {
    await writeFile(testFile, 'wrong content');
    
    const watchPromise = watchForFile(testFile, {
      content: 'expected text',
      timeout: 100
    });
    
    await expect(watchPromise).rejects.toThrow('Timeout waiting for file');
  });
  
  test('should handle multiple file changes', async () => {
    const watchPromise = watchForFile(testFile, {
      content: 'final content',
      timeout: 5000
    });
    
    // Create file with wrong content first
    setTimeout(() => {
      writeFile(testFile, 'wrong content');
    }, 50);
    
    // Update with correct content later
    setTimeout(() => {
      writeFile(testFile, 'this has the final content now');
    }, 150);
    
    await expect(watchPromise).resolves.toBeUndefined();
  });
  
  test('should handle non-existent directory', async () => {
    const nonExistentFile = path.join(testDir, 'subdir', 'file.txt');
    
    const watchPromise = watchForFile(nonExistentFile, { timeout: 100 });
    
    await expect(watchPromise).rejects.toThrow('Failed to watch directory');
  });
});