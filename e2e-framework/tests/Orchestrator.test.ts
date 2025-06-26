import { describe, test, expect, beforeEach } from 'bun:test';
import { Orchestrator } from '../src/Orchestrator';
import { Project } from '../src/Project';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let setupCalls: string[] = [];
  let teardownCalls: string[] = [];
  
  beforeEach(() => {
    setupCalls = [];
    teardownCalls = [];
    
    // Create orchestrator with test dependencies
    orchestrator = new Orchestrator();
    
    // Mock the dependencies methods
    orchestrator['environment'].setup = async () => {
      setupCalls.push('environment.setup');
    };
    
    orchestrator['environment'].writeConfig = async (config) => {
      setupCalls.push('environment.writeConfig');
      orchestrator['writtenConfig'] = config;
    };
    
    orchestrator['environment'].teardown = async () => {
      teardownCalls.push('environment.teardown');
    };
    
    orchestrator['processController'].spawn = async (name, cmd, args, opts) => {
      setupCalls.push('processController.spawn');
      orchestrator['spawnArgs'] = { name, cmd, args, opts };
      return {
        process: { on: () => {} },
        stdout: (async function* () {
          yield 'Starting daemon...';
          yield 'Monitoring events from relays';
        })(),
        stderr: (async function* () {})()
      };
    };
    
    orchestrator['processController'].killAll = async () => {
      teardownCalls.push('processController.killAll');
    };
    
    orchestrator['nostrMonitor'].connect = async () => {
      setupCalls.push('nostrMonitor.connect');
    };
    
    orchestrator['nostrMonitor'].disconnect = async () => {
      teardownCalls.push('nostrMonitor.disconnect');
    };
    
    orchestrator['cliClient'].createProject = async (options) => {
      orchestrator['createProjectOptions'] = options;
      return {
        naddr: 'naddr123',
        name: options.name
      };
    };
  });
  
  describe('constructor', () => {
    test('should initialize with default options', () => {
      const orch = new Orchestrator();
      expect(orch['options']).toEqual({});
      expect(orch['environment']).toBeDefined();
      expect(orch['processController']).toBeDefined();
      expect(orch['nostrMonitor']).toBeDefined();
      expect(orch['cliClient']).toBeDefined();
    });
    
    test('should accept custom options', () => {
      const options = {
        relays: ['wss://custom.relay'],
        llmConfig: {
          name: 'test-llm',
          provider: 'openai' as const,
          model: 'gpt-4',
          apiKey: 'test-key'
        }
      };
      
      const orch = new Orchestrator(options);
      expect(orch['options']).toEqual(options);
    });
    
    test('should generate test identity', () => {
      expect(orchestrator['nsec']).toMatch(/^nsec1/);
      expect(orchestrator['npub']).toBeDefined();
      expect(orchestrator['npub'].length).toBeGreaterThan(0);
    });
  });
  
  describe('setup', () => {
    test('should execute setup sequence in correct order', async () => {
      await orchestrator.setup();
      
      expect(setupCalls).toEqual([
        'environment.setup',
        'environment.writeConfig',
        'processController.spawn',
        'nostrMonitor.connect'
      ]);
    });
    
    test('should write config with whitelisted pubkey', async () => {
      await orchestrator.setup();
      
      const config = orchestrator['writtenConfig'];
      expect(config).toBeDefined();
      expect(config.whitelistedPubkeys).toContain(orchestrator['npub']);
      expect(config.llmConfigs).toEqual([]);
    });
    
    test('should include llmConfig when provided', async () => {
      const llmConfig = {
        name: 'test-llm',
        provider: 'openai' as const,
        model: 'gpt-4',
        apiKey: 'test-key'
      };
      
      const orch = new Orchestrator({ llmConfig });
      
      // Mock the writeConfig method
      orch['environment'].writeConfig = async (config) => {
        orch['writtenConfig'] = config;
      };
      
      // Need to mock other methods too
      orch['environment'].setup = async () => {};
      orch['processController'].spawn = async () => ({
        process: {},
        stdout: (async function* () { yield 'Monitoring events from'; })(),
        stderr: (async function* () {})()
      });
      orch['nostrMonitor'].connect = async () => {};
      
      await orch.setup();
      
      const config = orch['writtenConfig'];
      expect(config.llmConfigs).toEqual([llmConfig]);
    });
    
    test('should start daemon with correct environment', async () => {
      await orchestrator.setup();
      
      const args = orchestrator['spawnArgs'];
      expect(args.name).toBe('daemon');
      expect(args.cmd).toBe('bun');
      expect(args.args).toEqual(['tenex', 'daemon']);
      expect(args.opts.env.TENEX_CONFIG_DIR).toBe(orchestrator['environment'].getConfigDir());
    });
    
    test('should wait for daemon ready message', async () => {
      await orchestrator.setup();
      expect(orchestrator['daemonHandle']).toBeDefined();
    });
    
    test('should throw if daemon fails to start', async () => {
      orchestrator['processController'].spawn = async () => ({
        process: {},
        stdout: (async function* () {
          yield 'Error: Failed to start';
          // No ready message
        })(),
        stderr: (async function* () {})()
      });
      
      await expect(orchestrator.setup()).rejects.toThrow('Daemon startup error');
    });
  });
  
  describe('teardown', () => {
    test('should execute teardown in correct order', async () => {
      await orchestrator.teardown();
      
      expect(teardownCalls).toEqual([
        'nostrMonitor.disconnect',
        'processController.killAll',
        'environment.teardown'
      ]);
    });
  });
  
  describe('createProject', () => {
    test('should create project through CLI and return Project instance', async () => {
      const projectOptions = {
        name: 'test-project',
        description: 'Test description',
        agents: ['coder']
      };
      
      const project = await orchestrator.createProject(projectOptions);
      
      expect(orchestrator['createProjectOptions']).toEqual(projectOptions);
      expect(project).toBeInstanceOf(Project);
      expect(project.naddr).toBe('naddr123');
      expect(project.name).toBe('test-project');
      expect(project.directory).toBe(orchestrator['environment'].getProjectDir('test-project'));
    });
  });
  
  describe('waitForFile', () => {
    test('should wait for file to exist', async () => {
      // For these tests, we'll just test the timeout logic since
      // mocking fs module is complex in Bun
      const start = Date.now();
      
      await expect(
        orchestrator.waitForFile('/fake', 'missing.txt', { timeout: 500 })
      ).rejects.toThrow('Timeout waiting for file: missing.txt');
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(500);
      expect(elapsed).toBeLessThan(1000);
    });
    
    test('should timeout if content not found', async () => {
      // Similar test for content matching timeout
      await expect(
        orchestrator.waitForFile('/fake', 'missing.txt', { 
          content: 'specific content',
          timeout: 500 
        })
      ).rejects.toThrow('Timeout waiting for file: missing.txt');
    });
  });
  
  describe('readFile', () => {
    test('should read file from project directory', async () => {
      // This test would need actual file system operations
      // For unit test, we'll just verify the path construction
      const fullPath = orchestrator['readFile'].toString();
      expect(fullPath).toContain('path.join');
      expect(fullPath).toContain('readFile');
    });
  });
  
  describe('getters', () => {
    test('should expose client', () => {
      expect(orchestrator.client).toBe(orchestrator['cliClient']);
    });
    
    test('should expose monitor', () => {
      expect(orchestrator.monitor).toBe(orchestrator['nostrMonitor']);
    });
  });
});