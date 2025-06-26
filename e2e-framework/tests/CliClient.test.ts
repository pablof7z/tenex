import { describe, test, expect, beforeEach } from 'bun:test';
import { CliClient } from '../src/CliClient';
import { ProcessController, type ProcessHandle } from '../src/ProcessController';
import type { ProjectInfo } from '../src/types';

// Helper to create mock process handle
function createMockHandle(stdout: string[], stderr: string[] = [], exitCode: number = 0): ProcessHandle {
  const stdoutIterator = (async function* () {
    for (const line of stdout) {
      yield line;
    }
  })();
  
  const stderrIterator = (async function* () {
    for (const line of stderr) {
      yield line;
    }
  })();
  
  const mockProcess = {
    on: (event: string, callback: Function) => {
      if (event === 'exit') {
        // Simulate process exit after a short delay
        setTimeout(() => callback(exitCode), 10);
      }
    },
    kill: () => true,
    killed: false,
    exitCode: null
  };
  
  return {
    process: mockProcess as any,
    stdout: stdoutIterator,
    stderr: stderrIterator
  };
}

describe('CliClient', () => {
  let client: CliClient;
  let mockController: ProcessController;
  let spawnCalls: any[] = [];
  const nsec = 'nsec1test123';
  const cliPath = '/path/to/cli.ts';
  
  beforeEach(() => {
    spawnCalls = [];
    mockController = {
      spawn: async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['{}']);
      },
      kill: async () => {},
      killAll: async () => {}
    } as any;
    
    client = new CliClient(mockController, nsec, cliPath);
  });
  
  describe('constructor', () => {
    test('should store nsec and cli path', () => {
      expect(client['nsec']).toBe(nsec);
      expect(client['cliPath']).toBe(cliPath);
      expect(client['processController']).toBe(mockController);
    });
  });
  
  describe('createProject', () => {
    test('should call CLI with required arguments', async () => {
      const projectInfo: ProjectInfo = {
        naddr: 'naddr123',
        name: 'test-project'
      };
      
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([JSON.stringify(projectInfo)]);
      };
      
      const result = await client.createProject({ name: 'test-project' });
      
      expect(spawnCalls.length).toBe(1);
      const [name, cmd, args, opts] = spawnCalls[0];
      expect(name).toMatch(/^cli-\d+$/);
      expect(cmd).toBe('bun');
      expect(args).toEqual([cliPath, '--json', 'project', 'create', '--name', 'test-project', '--nsec', nsec]);
      expect(opts.env.NODE_ENV).toBe('test');
      
      expect(result).toEqual(projectInfo);
    });
    
    test('should include optional arguments when provided', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['{"naddr":"naddr123","name":"test"}']);
      };
      
      await client.createProject({
        name: 'test',
        description: 'Test project',
        template: 'react',
        agents: ['coder', 'architect'],
        instructions: ['be-fast', 'be-good']
      });
      
      const args = spawnCalls[0][2];
      
      expect(args).toContain('--description');
      expect(args).toContain('Test project');
      expect(args).toContain('--template');
      expect(args).toContain('react');
      expect(args).toContain('--agents');
      expect(args).toContain('coder,architect');
      expect(args).toContain('--instructions');
      expect(args).toContain('be-fast,be-good');
    });
    
    test('should handle empty agents and instructions arrays', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['{"naddr":"naddr123","name":"test"}']);
      };
      
      await client.createProject({
        name: 'test',
        agents: [],
        instructions: []
      });
      
      const args = spawnCalls[0][2];
      
      expect(args).not.toContain('--agents');
      expect(args).not.toContain('--instructions');
    });
  });
  
  describe('sendMessage', () => {
    test('should send message and return thread ID', async () => {
      const response = { threadId: 'thread123' };
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([JSON.stringify(response)]);
      };
      
      const threadId = await client.sendMessage('naddr123', 'Hello world');
      
      expect(spawnCalls.length).toBe(1);
      const [name, cmd, args, opts] = spawnCalls[0];
      expect(name).toMatch(/^cli-\d+$/);
      expect(cmd).toBe('bun');
      expect(args).toEqual([cliPath, '--json', 'message', '--nsec', nsec, '--project', 'naddr123', '--message', 'Hello world']);
      expect(opts.env.NODE_ENV).toBe('test');
      
      expect(threadId).toBe('thread123');
    });
    
    test('should handle messages with special characters', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['{"threadId":"thread123"}']);
      };
      
      await client.sendMessage('naddr123', 'Message with "quotes" and \nnewlines');
      
      const args = spawnCalls[0][2];
      const messageIndex = args.indexOf('--message');
      
      expect(args[messageIndex + 1]).toBe('Message with "quotes" and \nnewlines');
    });
  });
  
  describe('listProjects', () => {
    test('should return list of projects', async () => {
      const projects: ProjectInfo[] = [
        { naddr: 'naddr1', name: 'project1' },
        { naddr: 'naddr2', name: 'project2' }
      ];
      
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([JSON.stringify(projects)]);
      };
      
      const result = await client.listProjects();
      
      expect(spawnCalls.length).toBe(1);
      const [name, cmd, args, opts] = spawnCalls[0];
      expect(name).toMatch(/^cli-\d+$/);
      expect(cmd).toBe('bun');
      expect(args).toEqual([cliPath, '--json', 'project', 'list', '--nsec', nsec]);
      expect(opts.env.NODE_ENV).toBe('test');
      
      expect(result).toEqual(projects);
    });
    
    test('should handle empty project list', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['[]']);
      };
      
      const result = await client.listProjects();
      expect(result).toEqual([]);
    });
  });
  
  describe('runCommand', () => {
    test('should collect stdout properly', async () => {
      const output = '["test"]';
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([output]);
      };
      
      const projects = await client.listProjects();
      
      expect(projects).toEqual(['test']);
    });
    
    test('should handle process exit with non-zero code', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([], ['Error occurred'], 1);
      };
      
      await expect(client.listProjects()).rejects.toThrow('CLI exited with code 1');
    });
    
    test('should include stderr in error message', async () => {
      const stderrLines = ['Error: Something went wrong', 'Stack trace here'];
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([], stderrLines, 1);
      };
      
      try {
        await client.listProjects();
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toContain('Error: Something went wrong');
        expect(error.message).toContain('Stack trace here');
      }
    });
    
    test('should handle process errors', async () => {
      const errorHandle: ProcessHandle = {
        process: {
          on: (event: string, callback: Function) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('Spawn failed')), 10);
            }
          },
          kill: () => {},
          killed: false,
          exitCode: null
        } as any,
        stdout: (async function* () { })(),
        stderr: (async function* () { })()
      };
      
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return errorHandle;
      };
      
      await expect(client.listProjects()).rejects.toThrow('CLI process error: Spawn failed');
    });
    
    test('should trim output whitespace', async () => {
      const projects = [{ naddr: 'naddr1', name: 'project1' }];
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle([JSON.stringify(projects) + '\n\n']);
      };
      
      const result = await client.listProjects();
      expect(result).toEqual(projects);
    });
    
    test('should handle multiline JSON output', async () => {
      const projects = { naddr: 'naddr1', name: 'project with\nnewline' };
      const jsonLines = JSON.stringify(projects, null, 2).split('\n');
      
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(jsonLines);
      };
      
      const result = await client.createProject({ name: 'test' });
      expect(result).toEqual(projects);
    });
    
    test('should use unique spawn names', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['[]']);
      };
      
      await client.listProjects();
      await client.listProjects();
      
      const name1 = spawnCalls[0][0];
      const name2 = spawnCalls[1][0];
      
      expect(name1).toMatch(/^cli-\d+$/);
      expect(name2).toMatch(/^cli-\d+$/);
      expect(name1).not.toBe(name2);
    });
    
    test('should handle invalid JSON response', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['Invalid JSON']);
      };
      
      await expect(client.listProjects()).rejects.toThrow();
    });
  });
  
  describe('environment', () => {
    test('should pass NODE_ENV=test', async () => {
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['[]']);
      };
      
      await client.listProjects();
      
      const options = spawnCalls[0][3];
      
      expect(options.env.NODE_ENV).toBe('test');
    });
    
    test('should preserve existing environment variables', async () => {
      const originalEnv = process.env.PATH;
      mockController.spawn = async (...args: any[]) => {
        spawnCalls.push(args);
        return createMockHandle(['[]']);
      };
      
      await client.listProjects();
      
      const options = spawnCalls[0][3];
      
      expect(options.env.PATH).toBe(originalEnv);
    });
  });
});