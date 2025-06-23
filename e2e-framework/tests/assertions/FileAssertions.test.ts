import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  assertFileContains,
  assertFileMatches,
  assertFileExists,
  assertFileDoesNotExist,
  assertFileSize,
  assertJsonFile
} from '../../src/assertions/FileAssertions';
import { Project } from '../../src/Project';

describe('FileAssertions', () => {
  let mockProject: Project;
  
  beforeEach(() => {
    // Create a mock project with necessary methods
    mockProject = {
      readFile: mock(async () => 'file content'),
      fileExists: mock(async () => true)
    } as any;
  });
  
  describe('assertFileContains', () => {
    test('should pass when file contains expected string', async () => {
      mockProject.readFile = mock(async () => 'Hello World');
      
      await expect(
        assertFileContains(mockProject, 'test.txt', 'Hello')
      ).resolves.toBeUndefined();
    });
    
    test('should throw when file does not contain expected string', async () => {
      mockProject.readFile = mock(async () => 'Hello World');
      
      await expect(
        assertFileContains(mockProject, 'test.txt', 'Goodbye')
      ).rejects.toThrow('File test.txt does not contain "Goodbye"');
    });
  });
  
  describe('assertFileMatches', () => {
    test('should pass when file matches pattern', async () => {
      mockProject.readFile = mock(async () => 'function test() { return 42; }');
      
      await expect(
        assertFileMatches(mockProject, 'test.js', /function.*\{.*\}/)
      ).resolves.toBeUndefined();
    });
    
    test('should throw when file does not match pattern', async () => {
      mockProject.readFile = mock(async () => 'const test = 42;');
      
      await expect(
        assertFileMatches(mockProject, 'test.js', /function.*\{.*\}/)
      ).rejects.toThrow(/does not match pattern/);
    });
  });
  
  describe('assertFileExists', () => {
    test('should pass when file exists', async () => {
      mockProject.fileExists = mock(async () => true);
      
      await expect(
        assertFileExists(mockProject, 'test.txt')
      ).resolves.toBeUndefined();
    });
    
    test('should throw when file does not exist', async () => {
      mockProject.fileExists = mock(async () => false);
      
      await expect(
        assertFileExists(mockProject, 'test.txt')
      ).rejects.toThrow('Expected file test.txt to exist but it does not');
    });
  });
  
  describe('assertFileDoesNotExist', () => {
    test('should pass when file does not exist', async () => {
      mockProject.fileExists = mock(async () => false);
      
      await expect(
        assertFileDoesNotExist(mockProject, 'test.txt')
      ).resolves.toBeUndefined();
    });
    
    test('should throw when file exists', async () => {
      mockProject.fileExists = mock(async () => true);
      
      await expect(
        assertFileDoesNotExist(mockProject, 'test.txt')
      ).rejects.toThrow('Expected file test.txt not to exist but it does');
    });
  });
  
  describe('assertFileSize', () => {
    test('should pass when file size is within range', async () => {
      mockProject.readFile = mock(async () => 'Hello World'); // 11 bytes
      
      await expect(
        assertFileSize(mockProject, 'test.txt', 10, 20)
      ).resolves.toBeUndefined();
    });
    
    test('should throw when file is too small', async () => {
      mockProject.readFile = mock(async () => 'Hi'); // 2 bytes
      
      await expect(
        assertFileSize(mockProject, 'test.txt', 10)
      ).rejects.toThrow('File test.txt is too small. Expected at least 10 bytes but got 2');
    });
    
    test('should throw when file is too large', async () => {
      mockProject.readFile = mock(async () => 'A'.repeat(100)); // 100 bytes
      
      await expect(
        assertFileSize(mockProject, 'test.txt', 10, 50)
      ).rejects.toThrow('File test.txt is too large. Expected at most 50 bytes but got 100');
    });
    
    test('should work with only minSize', async () => {
      mockProject.readFile = mock(async () => 'Hello World'); // 11 bytes
      
      await expect(
        assertFileSize(mockProject, 'test.txt', 10)
      ).resolves.toBeUndefined();
    });
  });
  
  describe('assertJsonFile', () => {
    test('should parse valid JSON and return it', async () => {
      const jsonContent = { name: 'test', value: 42 };
      mockProject.readFile = mock(async () => JSON.stringify(jsonContent));
      
      const result = await assertJsonFile(mockProject, 'test.json');
      expect(result).toEqual(jsonContent);
    });
    
    test('should throw on invalid JSON', async () => {
      mockProject.readFile = mock(async () => '{ invalid json }');
      
      await expect(
        assertJsonFile(mockProject, 'test.json')
      ).rejects.toThrow('File test.json is not valid JSON');
    });
    
    test('should run validator function on JSON', async () => {
      const jsonContent = { name: 'test', value: 42 };
      mockProject.readFile = mock(async () => JSON.stringify(jsonContent));
      
      const validator = (json: any) => {
        if (json.value !== 42) {
          throw new Error('Value must be 42');
        }
      };
      
      await expect(
        assertJsonFile(mockProject, 'test.json', validator)
      ).resolves.toEqual(jsonContent);
    });
    
    test('should throw when validator fails', async () => {
      const jsonContent = { name: 'test', value: 10 };
      mockProject.readFile = mock(async () => JSON.stringify(jsonContent));
      
      const validator = (json: any) => {
        if (json.value !== 42) {
          throw new Error('Value must be 42');
        }
      };
      
      await expect(
        assertJsonFile(mockProject, 'test.json', validator)
      ).rejects.toThrow('JSON validation failed for test.json: Value must be 42');
    });
  });
});