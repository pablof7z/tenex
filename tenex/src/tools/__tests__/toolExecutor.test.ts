import { describe, it, expect, beforeEach } from 'vitest';
import { executeTools } from '../toolExecutor';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

describe('toolExecutor', () => {
  let testDir: string;
  let context: any;

  beforeEach(async () => {
    // Create a unique test directory
    const randomId = randomBytes(8).toString('hex');
    testDir = join(tmpdir(), `test-${randomId}`);
    await mkdir(testDir, { recursive: true });

    context = {
      projectRoot: testDir,
      conversationId: 'test-conversation',
    };
  });

  describe('JSON format', () => {
    it('should execute read_file tool', async () => {
      // Create a test file
      const testFilePath = join(testDir, 'test.txt');
      const testContent = 'Hello, World!';
      await writeFile(testFilePath, testContent);

      const input = `Let me read this file: <tool_use>{ "tool": "read_file", "args": { "path": "test.txt" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Let me read this file:');
      expect(result).toContain('```');
      expect(result).toContain(testContent);
    });

    it('should execute write_file tool', async () => {
      const input = `Creating a file: <tool_use>{ "tool": "write_file", "args": { "path": "output.txt", "content": "Test content" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Creating a file:');
      expect(result).toContain('File written: output.txt');

      // Verify file was created
      const content = await readFile(join(testDir, 'output.txt'), 'utf-8');
      expect(content).toBe('Test content');
    });

    it('should execute shell tool', async () => {
      const input = `Running command: <tool_use>{ "tool": "shell", "args": { "command": "echo 'Hello from shell'" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Running command:');
      expect(result).toContain('Hello from shell');
    });

    it('should execute get_time tool', async () => {
      const input = `What time is it? <tool_use>{ "tool": "get_time" }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('What time is it?');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO date format
    });

    it('should handle multiple tool uses', async () => {
      await writeFile(join(testDir, 'test.txt'), 'File content');

      const input = `Let me read a file: <tool_use>{ "tool": "read_file", "args": { "path": "test.txt" } }</tool_use> and check the time: <tool_use>{ "tool": "get_time" }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Let me read a file:');
      expect(result).toContain('File content');
      expect(result).toContain('and check the time:');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle tool errors gracefully', async () => {
      const input = `Reading missing file: <tool_use>{ "tool": "read_file", "args": { "path": "nonexistent.txt" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Reading missing file:');
      expect(result).toContain('Error:');
      expect(result).toContain('Failed to read nonexistent.txt');
    });

    it('should handle invalid JSON gracefully', async () => {
      const input = `Bad JSON: <tool_use>{ invalid json }</tool_use>`;
      const result = await executeTools(input, context);

      // Should leave the original text unchanged
      expect(result).toBe(input);
    });

    it('should handle missing required parameters', async () => {
      const input = `Missing path: <tool_use>{ "tool": "read_file", "args": {} }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Missing path:');
      expect(result).toContain('Error: Missing path parameter');
    });
  });

  describe('Edit file functionality', () => {
    it('should execute edit_file tool with JSON', async () => {
      // Create initial file
      const testFilePath = join(testDir, 'edit-test.txt');
      await writeFile(testFilePath, 'Original content here');

      const input = `Editing file: <tool_use>{ "tool": "edit_file", "args": { "path": "edit-test.txt", "from": "Original", "to": "Updated" } }</tool_use>`;
      const result = await executeTools(input, context);

      expect(result).toContain('Editing file:');
      expect(result).toContain('File written: edit-test.txt');

      // Verify edit
      const content = await readFile(testFilePath, 'utf-8');
      expect(content).toBe('Updated content here');
    });
  });
});