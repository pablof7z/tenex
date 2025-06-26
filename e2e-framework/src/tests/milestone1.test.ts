import { test, expect } from 'bun:test';
import { TestEnvironment } from '../TestEnvironment';
import { ProcessController } from '../ProcessController';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

test('TestEnvironment - can create and destroy isolated test directories', async () => {
  const env = new TestEnvironment();
  
  // Setup
  await env.setup();
  const configDir = env.getConfigDir();
  const projectDir = env.getProjectDir('test-project');
  
  // Verify directories exist
  expect(existsSync(configDir)).toBe(true);
  expect(existsSync(projectDir.replace('/test-project', ''))).toBe(true);
  
  // Write config
  await env.writeConfig({
    whitelistedPubkeys: ['test-pubkey'],
    llmConfigs: [{
      provider: 'openai',
      model: 'gpt-4'
    }]
  });
  
  // Verify config was written
  const configPath = `${configDir}/config.json`;
  expect(existsSync(configPath)).toBe(true);
  const configContent = await readFile(configPath, 'utf-8');
  const config = JSON.parse(configContent);
  expect(config.whitelistedPubkeys).toEqual(['test-pubkey']);
  
  // Teardown
  await env.teardown();
  
  // Verify cleanup
  expect(existsSync(configDir)).toBe(false);
});

test('ProcessController - can spawn and kill processes reliably', async () => {
  const controller = new ProcessController();
  
  // Spawn a simple echo process
  const handle = await controller.spawn('test', 'echo', ['hello', 'world']);
  
  // Collect output
  const output: string[] = [];
  for await (const line of handle.stdout) {
    output.push(line);
  }
  
  // Verify output
  expect(output).toEqual(['hello world']);
  
  // Clean up
  await controller.killAll();
});

test('ProcessController - process stdout/stderr captured correctly', async () => {
  const controller = new ProcessController();
  
  // Spawn a process that writes to both stdout and stderr
  const handle = await controller.spawn('test', 'sh', ['-c', 'echo "stdout message" && echo "stderr message" >&2']);
  
  // Collect outputs
  const stdout: string[] = [];
  const stderr: string[] = [];
  
  // Read stdout
  for await (const line of handle.stdout) {
    stdout.push(line);
  }
  
  // Read stderr
  for await (const line of handle.stderr) {
    stderr.push(line);
  }
  
  // Verify outputs
  expect(stdout).toEqual(['stdout message']);
  expect(stderr).toEqual(['stderr message']);
  
  // Clean up
  await controller.killAll();
});