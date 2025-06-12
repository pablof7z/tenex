import { spawn } from 'child_process';
import chalk from 'chalk';
import type { ToolDefinition, ToolContext } from '../types';
import { ClaudeCodeOutputParser } from './parser';
import type { ClaudeCodeOptions } from './types';

export const claudeCodeTool: ToolDefinition = {
  name: 'write_code',
  description: 'Use Claude Code to write, modify, or analyze code. This tool should be used for ANY task that requires writing or modifying code files.',
  parameters: [
    {
      name: 'task',
      type: 'string',
      description: 'The coding task to perform. Be specific about what code needs to be written or modified.',
      required: true
    },
    {
      name: 'context',
      type: 'string',
      description: 'Additional context about the project, existing code structure, or requirements',
      required: false
    },
    {
      name: 'files',
      type: 'array',
      description: 'Specific files to work with (if known)',
      required: false,
      items: {
        type: 'string',
        description: 'File path'
      }
    }
  ],
  execute: async (params, toolContext?: ToolContext) => {
    const { task, context, files } = params;
    
    // Build the prompt for Claude Code
    let prompt = task;
    
    if (context) {
      prompt += `\n\nContext: ${context}`;
    }
    
    if (files && Array.isArray(files) && files.length > 0) {
      prompt += `\n\nRelevant files: ${files.join(', ')}`;
    }
    
    console.log(chalk.blue('\n🚀 Starting Claude Code...'));
    console.log(chalk.gray('Full prompt:'));
    console.log(chalk.gray(prompt));
    console.log();
    
    try {
      const result = await executeClaudeCode({
        prompt,
        verbose: true,
        outputFormat: 'stream-json',
        dangerouslySkipPermissions: true
      }, toolContext);
      
      return {
        success: true,
        output: result
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Claude Code execution failed'
      };
    }
  }
};

function executeClaudeCode(options: ClaudeCodeOptions, toolContext?: ToolContext): Promise<string> {
  return new Promise((resolve, reject) => {
    // Match the working command format
    const args = [
      '-p',
      '--dangerously-skip-permissions',
      '--output-format', 'stream-json',
      '--verbose',
      options.prompt
    ];
    
    // Show the actual command being run
    console.log(chalk.gray('Command:'), `claude ${args.map(arg => arg.includes(' ') ? `'${arg}'` : arg).join(' ')}`);
    console.log(chalk.gray('Working directory:'), options.projectPath || process.cwd());
    console.log(chalk.yellow('\nExecuting Claude Code...\n'));
    
    const claudeProcess = spawn('claude', args, {
      cwd: options.projectPath || process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'inherit']  // ignore stdin, pipe stdout, inherit stderr
    });
    
    console.log(chalk.gray('Claude process PID:'), claudeProcess.pid);
    
    const parser = new ClaudeCodeOutputParser(toolContext);
    let finalResult = '';
    let hasError = false;
    
    // Set encoding for better string handling
    if (claudeProcess.stdout) {
      claudeProcess.stdout.setEncoding('utf8');
    }
    
    claudeProcess.stdout?.on('data', (chunk: string) => {
      const messages = parser.parseLines(chunk);
      
      // Capture the final result
      for (const message of messages) {
        if (message.type === 'result') {
          if (message.result) {
            finalResult = message.result;
          }
          if (message.is_error) {
            hasError = true;
          }
        }
      }
    });
    
    // stderr is inherited, so it will show directly in console
    
    claudeProcess.on('close', (code) => {
      if (code !== 0 || hasError) {
        reject(new Error(`Claude Code exited with code ${code}`));
      } else {
        // Include summary statistics in the result
        const stats = [];
        if (parser.getMessageCount() > 0) {
          stats.push(`${parser.getMessageCount()} messages`);
        }
        if (parser.getTotalCost() > 0) {
          stats.push(`$${parser.getTotalCost().toFixed(4)}`);
        }
        
        const summary = stats.length > 0 ? ` (${stats.join(', ')})` : '';
        resolve(finalResult || `Code task completed successfully${summary}`);
      }
    });
    
    claudeProcess.on('error', (error) => {
      console.error(chalk.red('Failed to start Claude Code:'), error.message);
      if (error.message.includes('ENOENT')) {
        console.error(chalk.yellow('\nMake sure Claude CLI is installed and in your PATH'));
        console.error(chalk.yellow('Install with: npm install -g @anthropic-ai/claude-cli'));
      }
      reject(new Error(`Failed to start Claude Code: ${error.message}`));
    });

  });
}