import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@tenex/shared';
import type { ToolExecutor, ToolInvocation, ToolExecutionContext, ToolExecutionResult } from '../types';

const execAsync = promisify(exec);

export class ShellExecutor implements ToolExecutor {
  name = 'shell';
  
  private readonly maxOutputLength = 10000;
  private readonly timeout = 30000; // 30 seconds
  
  canExecute(toolName: string): boolean {
    return toolName === 'shell';
  }
  
  async execute(
    invocation: ToolInvocation,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      const command = invocation.parameters.command as string;
      
      // Security check - basic command validation
      if (this.isDangerousCommand(command)) {
        throw new Error('Command contains potentially dangerous operations');
      }
      
      logger.info('Executing shell command', {
        command,
        cwd: context.projectPath,
        agent: context.agentName
      });
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.projectPath,
        timeout: this.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });
      
      const output = stdout || stderr;
      const truncated = output.length > this.maxOutputLength;
      const finalOutput = truncated 
        ? output.substring(0, this.maxOutputLength) + '\n... (output truncated)'
        : output;
      
      return {
        success: !stderr || stderr.length === 0,
        output: finalOutput,
        duration: Date.now() - startTime,
        metadata: {
          truncated,
          originalLength: output.length,
          hasStderr: stderr.length > 0
        }
      };
    } catch (error) {
      logger.error('Shell command execution failed', { error, invocation });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
  
  private isDangerousCommand(command: string): boolean {
    const dangerous = [
      'rm -rf /',
      'dd if=/dev/zero',
      'mkfs',
      'format',
      ':(){ :|:& };:',  // Fork bomb
      '/dev/sda',
      'chmod -R 777 /',
      'shutdown',
      'reboot'
    ];
    
    return dangerous.some(pattern => command.includes(pattern));
  }
}