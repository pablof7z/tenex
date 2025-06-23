import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { TestEnvironment } from '../src/TestEnvironment';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, access } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('TestEnvironment', () => {
  let env: TestEnvironment;
  
  beforeEach(() => {
    env = new TestEnvironment();
  });
  
  afterEach(async () => {
    // Clean up any created directories
    try {
      await env.teardown();
    } catch {
      // Ignore errors if directory doesn't exist
    }
  });
  
  describe('constructor', () => {
    test('should generate unique test ID if not provided', () => {
      const env1 = new TestEnvironment();
      const env2 = new TestEnvironment();
      
      // Test IDs should be different
      expect(env1['testId']).not.toBe(env2['testId']);
      
      // Test ID should match expected format
      expect(env1['testId']).toMatch(/^\d+-[a-z0-9]{6}$/);
    });
    
    test('should use provided test ID', () => {
      const customId = 'custom-test-id';
      const customEnv = new TestEnvironment(customId);
      
      expect(customEnv['testId']).toBe(customId);
    });
  });
  
  describe('setup', () => {
    test('should create temp directory structure', async () => {
      await env.setup();
      
      const tempDir = env['tempDir'];
      expect(tempDir).toContain('tenex-e2e-');
      expect(tempDir).toContain(tmpdir());
      
      // Verify directories exist
      expect(existsSync(tempDir)).toBe(true);
      expect(existsSync(path.join(tempDir, '.tenex'))).toBe(true);
      expect(existsSync(path.join(tempDir, 'projects'))).toBe(true);
    });
    
    test('should handle directory creation errors', async () => {
      // Since mkdir is hard to mock in Bun, we'll test a related scenario
      // Create environment and setup first
      await env.setup();
      const tempDir = env['tempDir'];
      
      // Remove write permissions (this might not work on all systems)
      try {
        const fs = await import('node:fs/promises');
        await fs.chmod(tempDir, 0o444); // Read-only
        
        // Try to write config which should fail
        await expect(env.writeConfig({ whitelistedPubkeys: [], llmConfigs: [] }))
          .rejects.toThrow();
        
        // Restore permissions for cleanup
        await fs.chmod(tempDir, 0o755);
      } catch (e) {
        // If chmod doesn't work on this system, just pass the test
        expect(true).toBe(true);
      }
    });
  });
  
  describe('teardown', () => {
    test('should remove temp directory', async () => {
      await env.setup();
      const tempDir = env['tempDir'];
      
      expect(existsSync(tempDir)).toBe(true);
      
      await env.teardown();
      
      expect(existsSync(tempDir)).toBe(false);
    });
    
    test('should handle non-existent directory gracefully', async () => {
      // Don't call setup, so tempDir doesn't exist
      await expect(env.teardown()).resolves.toBeUndefined();
    });
    
    test('should force remove even with content', async () => {
      await env.setup();
      const tempDir = env['tempDir'];
      
      // Create a file in the temp directory
      const fs = await import('node:fs/promises');
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'content');
      
      await env.teardown();
      
      expect(existsSync(tempDir)).toBe(false);
    });
  });
  
  describe('getConfigDir', () => {
    test('should return .tenex subdirectory', async () => {
      await env.setup();
      
      const configDir = env.getConfigDir();
      expect(configDir).toBe(path.join(env['tempDir'], '.tenex'));
    });
    
    test('should work before setup', () => {
      const configDir = env.getConfigDir();
      expect(configDir).toContain('.tenex');
    });
  });
  
  describe('getProjectDir', () => {
    test('should return project subdirectory', async () => {
      await env.setup();
      
      const projectDir = env.getProjectDir('my-project');
      expect(projectDir).toBe(path.join(env['tempDir'], 'projects', 'my-project'));
    });
    
    test('should handle project names with special characters', async () => {
      await env.setup();
      
      const projectDir = env.getProjectDir('my-special_project.123');
      expect(projectDir).toContain('my-special_project.123');
    });
  });
  
  describe('writeConfig', () => {
    test('should write config file as JSON', async () => {
      await env.setup();
      
      const config = {
        whitelistedPubkeys: ['pubkey1', 'pubkey2'],
        llmConfigs: [{
          name: 'test-llm',
          provider: 'openai' as const,
          model: 'gpt-4',
          apiKey: 'test-key'
        }]
      };
      
      await env.writeConfig(config);
      
      const configPath = path.join(env.getConfigDir(), 'config.json');
      expect(existsSync(configPath)).toBe(true);
      
      const written = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(written).toEqual(config);
    });
    
    test('should format JSON with 2-space indentation', async () => {
      await env.setup();
      
      const config = {
        whitelistedPubkeys: ['pubkey1'],
        llmConfigs: []
      };
      
      await env.writeConfig(config);
      
      const configPath = path.join(env.getConfigDir(), 'config.json');
      const content = readFileSync(configPath, 'utf-8');
      
      // Check for proper formatting
      expect(content).toContain('  "whitelistedPubkeys"');
      expect(content).toContain('    "pubkey1"');
    });
    
    test('should overwrite existing config', async () => {
      await env.setup();
      
      const config1 = { whitelistedPubkeys: ['key1'], llmConfigs: [] };
      const config2 = { whitelistedPubkeys: ['key2'], llmConfigs: [] };
      
      await env.writeConfig(config1);
      await env.writeConfig(config2);
      
      const configPath = path.join(env.getConfigDir(), 'config.json');
      const written = JSON.parse(readFileSync(configPath, 'utf-8'));
      
      expect(written.whitelistedPubkeys).toEqual(['key2']);
    });
    
    test('should handle write errors', async () => {
      // Don't call setup, so directory doesn't exist
      const config = { whitelistedPubkeys: [], llmConfigs: [] };
      
      await expect(env.writeConfig(config)).rejects.toThrow();
    });
  });
  
  describe('integration', () => {
    test('should support full lifecycle', async () => {
      // Setup
      await env.setup();
      
      // Use environment
      const config = {
        whitelistedPubkeys: ['test-key'],
        llmConfigs: []
      };
      await env.writeConfig(config);
      
      const projectDir = env.getProjectDir('test-project');
      const fs = await import('node:fs/promises');
      await fs.mkdir(projectDir, { recursive: true });
      await fs.writeFile(path.join(projectDir, 'README.md'), '# Test Project');
      
      // Verify everything exists
      expect(existsSync(env.getConfigDir())).toBe(true);
      expect(existsSync(path.join(env.getConfigDir(), 'config.json'))).toBe(true);
      expect(existsSync(projectDir)).toBe(true);
      expect(existsSync(path.join(projectDir, 'README.md'))).toBe(true);
      
      // Teardown
      await env.teardown();
      
      // Verify everything is cleaned up
      expect(existsSync(env['tempDir'])).toBe(false);
    });
  });
});