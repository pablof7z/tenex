import { ProcessController } from './ProcessController';
import type { ProjectInfo } from './types';
import { retry } from './utils/Retry';
import { Logger } from './utils/Logger';

export class CliClient {
  private logger: Logger;
  
  constructor(
    private processController: ProcessController,
    private nsec: string,
    private cliPath: string
  ) {
    this.logger = new Logger({ component: 'CliClient' });
  }
  
  async createProject(options: {
    name: string;
    description?: string;
    template?: string;
    agents?: string[];
    instructions?: string[];
  }): Promise<ProjectInfo> {
    const args = ['--json', 'project', 'create'];
    
    // Build command arguments
    args.push('--name', options.name);
    args.push('--nsec', this.nsec);
    if (options.description) args.push('--description', options.description);
    // Note: cli-client doesn't support template, agents, or instructions
    // These would need to be added after project creation via separate commands
    
    // Use retry for command execution
    const output = await retry(
      () => this.runCommand(args),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        logger: this.logger
      }
    );
    
    const result = await this.parseJsonResponse(output, 'project creation');
    this.logger.debug('Project creation response', { result });
    
    // Send project start event
    await this.startProject(result.naddr);
    
    // Give the daemon a moment to process the start event
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return result;
  }
  
  async startProject(projectNaddr: string): Promise<void> {
    const args = ['project', 'start', '--nsec', this.nsec, '--project', projectNaddr];
    
    this.logger.info('Starting project', { projectNaddr });
    
    // Use retry for command execution
    await retry(
      () => this.runCommand(args),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        logger: this.logger
      }
    );
    
    // Just verify it succeeded, no response data expected
    this.logger.debug('Project started successfully');
  }
  
  async sendMessage(projectNaddr: string, message: string): Promise<string> {
    const args = ['--json', 'message', '--nsec', this.nsec, '--project', projectNaddr, '--message', message];
    
    this.logger.info('Sending message to project', { 
      projectNaddr,
      message: message.substring(0, 50) + '...'
    });
    
    // Use retry for command execution
    const output = await retry(
      () => this.runCommand(args),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        logger: this.logger
      }
    );
    
    const parsed = await this.parseJsonResponse(output, 'message');
    this.logger.debug('Message sent successfully', { threadId: parsed.threadId });
    
    if (!parsed.threadId) {
      throw new Error('Response missing threadId field');
    }
    return parsed.threadId;
  }
  
  async listProjects(): Promise<ProjectInfo[]> {
    const args = ['--json', 'project', 'list', '--nsec', this.nsec];
    
    // Use retry for command execution
    const output = await retry(
      () => this.runCommand(args),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        logger: this.logger
      }
    );
    
    return this.parseJsonResponse(output, 'project list');
  }
  
  private async runCommand(args: string[]): Promise<string> {
    this.logger.debug('Running CLI command', { 
      command: 'bun',
      args: [this.cliPath, ...args]
    });
    
    const handle = await this.processController.spawn(
      `cli-${Date.now()}`,
      'bun',
      [this.cliPath, ...args],
      {
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      }
    );
    
    let output = '';
    let errorOutput = '';
    
    // Collect stdout
    for await (const line of handle.stdout) {
      output += line + '\n';
    }
    
    // Collect stderr (but don't wait for it to complete)
    const stderrPromise = (async () => {
      for await (const line of handle.stderr) {
        errorOutput += line + '\n';
      }
    })();
    
    // Wait for process to exit
    await new Promise<void>((resolve, reject) => {
      handle.process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error('CLI command failed', {
            exitCode: code,
            stderr: errorOutput,
            stdout: output
          });
          reject(new Error(`CLI exited with code ${code}: ${errorOutput}`));
        }
      });
      
      handle.process.on('error', (err) => {
        reject(new Error(`CLI process error: ${err.message}`));
      });
    });
    
    // Ensure stderr collection is complete
    await stderrPromise;
    
    return output.trim();
  }
  
  private async parseJsonResponse(output: string, context: string): Promise<any> {
    try {
      const lines = output.trim().split('\n');
      
      // Try each line and silently ignore parsing failures
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          // If we successfully parsed JSON, return it
          return parsed;
        } catch {
          // Silently ignore non-JSON lines
          continue;
        }
      }
      
      // If no single line worked, try to find JSON starting with { or [
      const jsonStart = Math.min(
        output.indexOf('{') !== -1 ? output.indexOf('{') : Infinity,
        output.indexOf('[') !== -1 ? output.indexOf('[') : Infinity
      );
      
      if (jsonStart !== Infinity) {
        try {
          const jsonStr = output.substring(jsonStart);
          return JSON.parse(jsonStr);
        } catch {
          // Fall through to error
        }
      }
      
      throw new Error(`No valid JSON found in output`);
    } catch (error: any) {
      this.logger.error(`Failed to parse ${context} response`, { 
        error: error.message,
        output: output.substring(0, 200) // Log first 200 chars
      });
      throw new Error(
        `Failed to parse ${context} response: ${error.message}\n` +
        `Output: ${output}`
      );
    }
  }
}