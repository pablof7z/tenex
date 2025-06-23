import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { type Readable } from 'node:stream';
import { getConfig } from './config';

export interface ProcessHandle {
  process: ChildProcess;
  stdout: AsyncIterableIterator<string>;
  stderr: AsyncIterableIterator<string>;
}

export class ProcessController {
  private processes: Map<string, ProcessHandle> = new Map();
  
  async spawn(
    name: string,
    command: string,
    args: string[],
    options: SpawnOptions = {}
  ): Promise<ProcessHandle> {
    const proc = spawn(command, args, {
      ...options,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const handle: ProcessHandle = {
      process: proc,
      stdout: this.createLineIterator(proc.stdout!),
      stderr: this.createLineIterator(proc.stderr!)
    };
    
    // Automatically remove the process from the map on exit
    proc.on('exit', () => {
      this.processes.delete(name);
    });
    
    this.processes.set(name, handle);
    return handle;
  }
  
  async kill(name: string): Promise<void> {
    const handle = this.processes.get(name);
    if (handle) {
      const config = getConfig();
      handle.process.kill(config.process.killSignal as any);
      this.processes.delete(name);
    }
  }
  
  async killAll(): Promise<void> {
    for (const [name] of this.processes) {
      await this.kill(name);
    }
  }
  
  private async *createLineIterator(stream: Readable): AsyncIterableIterator<string> {
    let buffer = '';
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        yield line;
      }
    }
    if (buffer) yield buffer;
  }
}