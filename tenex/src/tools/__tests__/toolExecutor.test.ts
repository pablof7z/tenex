import { describe, it, expect, beforeEach } from 'vitest';
import { executeTools } from '../toolExecutor';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import type { ToolExecutionContext } from '../types';

describe('toolExecutor', () => {
  let testDir: string;
  let context: Partial<ToolExecutionContext>;

  beforeEach(async () => {
    // Create a unique test directory
    const randomId = randomBytes(8).toString('hex');
    testDir = join(tmpdir(), `test-${randomId}`);
    await mkdir(testDir, { recursive: true });

    context = {
      projectPath: testDir,
      conversationId: 'test-conversation',
      agentName: 'test-agent',
      phase: 'test',
    } as Partial<ToolExecutionContext>;
  });

  describe('JSON format', () => {
    it('should execute read_file tool', async () => {
      // Create a test file
      const testFilePath = join(testDir, 'test.txt');
      const testContent = 'Hello, World!';
      await writeFile(testFilePath, testContent);

      const input = `Let me read this file: <tool_use>{ "tool": "read_file", "args": { "path": "test.txt" } }</tool_use>`;
      const result = await executeTools(input, context as ToolExecutionContext);

      expect(result.processedContent).toContain('Let me read this file:');
      expect(result.processedContent).toContain('```');
      expect(result.processedContent).toContain(testContent);
    });


    it('should execute shell tool', async () => {
      const input = `Running command: <tool_use>{ "tool": "shell", "args": { "command": "echo 'Hello from shell'" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result.processedContent).toContain('Running command:');
      expect(result.processedContent).toContain('Hello from shell');
    });

    it('should execute get_time tool', async () => {
      const input = `What time is it? <tool_use>{ "tool": "get_time" }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result.processedContent).toContain('What time is it?');
      expect(result.processedContent).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
    });

    it('should handle multiple tool uses', async () => {
      await writeFile(join(testDir, 'test.txt'), 'File content');

      const input = `Let me read a file: <tool_use>{ "tool": "read_file", "args": { "path": "test.txt" } }</tool_use> and check the time: <tool_use>{ "tool": "get_time" }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result.processedContent).toContain('Let me read a file:');
      expect(result.processedContent).toContain('File content');
      expect(result.processedContent).toContain('and check the time:');
      expect(result.processedContent).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle tool errors gracefully', async () => {
      const input = `Reading missing file: <tool_use>{ "tool": "read_file", "args": { "path": "nonexistent.txt" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result.processedContent).toContain('Reading missing file:');
      expect(result.processedContent).toContain('Error:');
      expect(result.processedContent).toContain('Failed to read nonexistent.txt');
    });

    it('should handle invalid JSON gracefully', async () => {
      const input = `Bad JSON: <tool_use>{ invalid json }</tool_use>`;
      const result = await executeTools(input, context);

      // Should leave the original text unchanged
      expect(result.processedContent).toBe(input);
    });

    it('should handle missing required parameters', async () => {
      const input = `Missing path: <tool_use>{ "tool": "read_file", "args": {} }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result.processedContent).toContain('Missing path:');
      expect(result.processedContent).toContain('Error: Invalid arguments: Required');
    });
  });

});