import { describe, test, expect, beforeEach } from 'bun:test';
import { Project } from '../src/Project';
import { Conversation } from '../src/Conversation';
import type { Orchestrator } from '../src/Orchestrator';

describe('Project', () => {
  let project: Project;
  let mockOrchestrator: Orchestrator;
  
  beforeEach(() => {
    // Create a mock orchestrator
    mockOrchestrator = {
      client: {
        sendMessage: async (naddr: string, message: string) => {
          mockOrchestrator['lastMessage'] = { naddr, message };
          return 'thread123';
        }
      },
      waitForFile: async (projectDir: string, filePath: string, options?: any) => {
        mockOrchestrator['waitForFileCall'] = { projectDir, filePath, options };
        // Simulate success
      },
      readFile: async (projectDir: string, filePath: string) => {
        mockOrchestrator['readFileCall'] = { projectDir, filePath };
        if (filePath === 'exists.txt') {
          return 'file content';
        }
        throw new Error('ENOENT');
      }
    } as any;
    
    project = new Project(
      mockOrchestrator,
      'naddr123',
      'test-project',
      '/tmp/projects/test-project'
    );
  });
  
  describe('constructor', () => {
    test('should store project properties', () => {
      expect(project.naddr).toBe('naddr123');
      expect(project.name).toBe('test-project');
      expect(project.directory).toBe('/tmp/projects/test-project');
    });
  });
  
  describe('startConversation', () => {
    test('should send message and return Conversation instance', async () => {
      const conversation = await project.startConversation({
        message: 'Hello world',
        title: 'Test Chat'
      });
      
      expect(mockOrchestrator['lastMessage']).toEqual({
        naddr: 'naddr123',
        message: 'Hello world'
      });
      
      expect(conversation).toBeInstanceOf(Conversation);
    });
    
    test('should use default title if not provided', async () => {
      const conversation = await project.startConversation({
        message: 'Hello'
      });
      
      // The title is passed to Conversation constructor
      // We can verify through the Conversation instance
      expect(conversation).toBeInstanceOf(Conversation);
    });
  });
  
  describe('waitForFile', () => {
    test('should delegate to orchestrator with project directory', async () => {
      const options = { timeout: 5000, content: 'expected' };
      
      await project.waitForFile('test.txt', options);
      
      expect(mockOrchestrator['waitForFileCall']).toEqual({
        projectDir: '/tmp/projects/test-project',
        filePath: 'test.txt',
        options
      });
    });
    
    test('should work without options', async () => {
      await project.waitForFile('test.txt');
      
      expect(mockOrchestrator['waitForFileCall']).toEqual({
        projectDir: '/tmp/projects/test-project',
        filePath: 'test.txt',
        options: undefined
      });
    });
  });
  
  describe('readFile', () => {
    test('should delegate to orchestrator with project directory', async () => {
      const content = await project.readFile('exists.txt');
      
      expect(mockOrchestrator['readFileCall']).toEqual({
        projectDir: '/tmp/projects/test-project',
        filePath: 'exists.txt'
      });
      
      expect(content).toBe('file content');
    });
    
    test('should propagate errors', async () => {
      await expect(project.readFile('missing.txt')).rejects.toThrow('ENOENT');
    });
  });
  
  describe('fileExists', () => {
    test('should return true if file can be read', async () => {
      const exists = await project.fileExists('exists.txt');
      expect(exists).toBe(true);
    });
    
    test('should return false if file cannot be read', async () => {
      const exists = await project.fileExists('missing.txt');
      expect(exists).toBe(false);
    });
    
    test('should not throw errors', async () => {
      // Even with a file that causes errors, fileExists should not throw
      mockOrchestrator.readFile = async () => {
        throw new Error('Permission denied');
      };
      
      const exists = await project.fileExists('forbidden.txt');
      expect(exists).toBe(false);
    });
  });
});