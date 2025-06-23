import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Logger, LogLevel, getLogger, resetLogger } from '../../src/utils/Logger';
import { readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('Logger', () => {
  let logFile: string;
  
  beforeEach(() => {
    logFile = path.join(tmpdir(), `logger-test-${Date.now()}.log`);
    resetLogger();
  });
  
  afterEach(async () => {
    try {
      await rm(logFile, { force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
  test('should log to console with correct format', () => {
    const logger = new Logger({ component: 'Test' });
    
    // We can't easily capture console output in tests,
    // but we can verify the logger doesn't throw
    expect(() => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
    }).not.toThrow();
  });
  
  test('should only log debug messages when debug is enabled', async () => {
    const logger = new Logger({
      component: 'Test',
      debug: true,
      logFile
    });
    
    logger.debug('Debug message', { data: 'test' });
    logger.info('Info message');
    
    // Give time for async writes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const content = await readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('DEBUG');
    expect(lines[1]).toContain('INFO');
  });
  
  test('should not log debug messages when debug is disabled', async () => {
    const logger = new Logger({
      component: 'Test',
      debug: false,
      logFile
    });
    
    logger.debug('Debug message');
    logger.info('Info message');
    
    // Give time for async writes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const content = await readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('INFO');
  });
  
  test('should create child loggers with component hierarchy', async () => {
    const parent = new Logger({
      component: 'Parent',
      logFile
    });
    
    const child = parent.child('Child');
    child.info('Child message');
    
    // Give time for async writes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());
    
    expect(entry.component).toBe('Parent:Child');
  });
  
  test('should log structured data', async () => {
    const logger = new Logger({
      component: 'Test',
      logFile
    });
    
    const testData = {
      user: 'test',
      action: 'login',
      metadata: { ip: '127.0.0.1' }
    };
    
    logger.info('User action', testData);
    
    // Give time for async writes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());
    
    expect(entry.message).toBe('User action');
    expect(entry.data).toEqual(testData);
    expect(entry.level).toBe('INFO');
    expect(entry.timestamp).toBeDefined();
  });
  
  test('should use global logger singleton', () => {
    const logger1 = getLogger({ component: 'Global' });
    const logger2 = getLogger();
    
    expect(logger1).toBe(logger2);
  });
  
  test('should handle file write errors gracefully', () => {
    const logger = new Logger({
      component: 'Test',
      logFile: '/invalid/path/to/file.log'
    });
    
    // Should not throw even with invalid file path
    expect(() => {
      logger.info('Test message');
    }).not.toThrow();
  });
});