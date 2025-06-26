import { ProcessController } from './ProcessController';
import type { ProjectInfo } from './types';
import { retry } from './utils/Retry';
import { Logger } from './utils/Logger';
import { NDKPrivateKeySigner, NDKEvent, type NDK } from '@nostr-dev-kit/ndk';

export class CliClient {
  private logger: Logger;
  private signer: NDKPrivateKeySigner;
  
  constructor(
    private processController: ProcessController,
    private nsec: string,
    private cliPath: string,
    private ndk: NDK
  ) {
    this.logger = new Logger({ component: 'CliClient' });
    this.signer = new NDKPrivateKeySigner(nsec);
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
    
    // Log the encoded event
    if (result.encode) {
      this.logger.info('Project event created', {
        eventId: result.eventId,
        encode: result.encode,
        naddr: result.naddr
      });
    }
    
    // Send project start event
    await this.startProject(result.naddr);
    
    // Give the daemon a moment to process the start event
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return result;
  }
  
  async startProject(projectNaddr: string): Promise<void> {
    const args = ['--json', 'project', 'start', '--nsec', this.nsec, '--project', projectNaddr];
    
    this.logger.info('Starting project', { projectNaddr });
    
    // Use retry for command execution
    const output = await retry(
      () => this.runCommand(args),
      {
        maxAttempts: 3,
        initialDelay: 1000,
        logger: this.logger
      }
    );
    
    // Try to parse JSON response if available
    try {
      const result = await this.parseJsonResponse(output, 'project start');
      this.logger.debug('Project started successfully', { eventId: result.eventId });
    } catch {
      // If no JSON response, just verify command succeeded
      this.logger.debug('Project started successfully (no JSON response)');
    }
  }
  
  async sendMessage(projectEvent: NDKEvent, message: string): Promise<string> {
    this.logger.info('Creating conversation', { 
      projectId: projectEvent.id,
      message: message.substring(0, 50) + '...'
    });
    
    // Create a new conversation event (kind 11 thread root)
    const conversationEvent = new NDKEvent(this.ndk);
    conversationEvent.kind = 11; // NIP-11 thread root
    conversationEvent.content = message;
    conversationEvent.tag(projectEvent);
    
    // Sign and publish the event
    await conversationEvent.sign(this.signer);
    await conversationEvent.publish();
    
    this.logger.info('Conversation event published', { 
      eventId: conversationEvent.id,
      encode: conversationEvent.rawEvent()
    });
    
    return conversationEvent.id;
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
          NODE_ENV: 'test',
          RELAYS: 'ws://localhost:10547'
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