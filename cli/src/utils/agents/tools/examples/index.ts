import type { ToolDefinition } from '../types';
import { readFile, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Example tool: Read a file
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'The path to the file to read',
      required: true
    }
  ],
  execute: async (params) => {
    try {
      const content = await readFile(params.path, 'utf-8');
      return {
        success: true,
        output: content
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Failed to read file'
      };
    }
  }
};

// Example tool: Write a file
export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'The path to the file to write',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'The content to write to the file',
      required: true
    }
  ],
  execute: async (params) => {
    try {
      await writeFile(params.path, params.content, 'utf-8');
      return {
        success: true,
        output: `Successfully wrote to ${params.path}`
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Failed to write file'
      };
    }
  }
};

// Example tool: Execute a shell command
export const shellTool: ToolDefinition = {
  name: 'shell',
  description: 'Execute a shell command',
  parameters: [
    {
      name: 'command',
      type: 'string',
      description: 'The shell command to execute',
      required: true
    },
    {
      name: 'cwd',
      type: 'string',
      description: 'The working directory for the command',
      required: false
    }
  ],
  execute: async (params) => {
    try {
      const { stdout, stderr } = await execAsync(params.command, {
        cwd: params.cwd || process.cwd()
      });
      
      return {
        success: true,
        output: stdout + (stderr ? `\n\nSTDERR:\n${stderr}` : '')
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Command failed'
      };
    }
  }
};

// Example tool: Search for files
export const searchFilesTool: ToolDefinition = {
  name: 'search_files',
  description: 'Search for files matching a pattern',
  parameters: [
    {
      name: 'pattern',
      type: 'string',
      description: 'The search pattern (glob pattern)',
      required: true
    },
    {
      name: 'directory',
      type: 'string',
      description: 'The directory to search in',
      required: false
    }
  ],
  execute: async (params) => {
    try {
      const { glob } = await import('glob');
      const cwd = params.directory || process.cwd();
      const files = await glob(params.pattern, { cwd });
      
      return {
        success: true,
        output: files.length > 0 
          ? `Found ${files.length} files:\n${files.join('\n')}`
          : 'No files found matching the pattern'
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }
};

// Example tool: Get current time
export const getTimeTool: ToolDefinition = {
  name: 'get_time',
  description: 'Get the current time in various formats',
  parameters: [
    {
      name: 'format',
      type: 'string',
      description: 'The time format',
      required: false,
      enum: ['iso', 'unix', 'locale']
    }
  ],
  execute: async (params) => {
    const now = new Date();
    let output: string;
    
    switch (params.format) {
      case 'unix':
        output = Math.floor(now.getTime() / 1000).toString();
        break;
      case 'locale':
        output = now.toLocaleString();
        break;
      case 'iso':
      default:
        output = now.toISOString();
    }
    
    return {
      success: true,
      output
    };
  }
};

// Export all example tools
export const exampleTools = [
  readFileTool,
  writeFileTool,
  shellTool,
  searchFilesTool,
  getTimeTool
];