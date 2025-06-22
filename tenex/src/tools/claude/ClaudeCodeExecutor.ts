import { spawn, type ChildProcess } from "node:child_process";
import { ClaudeParser, type ClaudeCodeMessage } from "@/utils/claude/ClaudeParser";
import { logger } from "@/utils/logger";

export interface ClaudeCodeExecutorOptions {
  prompt: string;
  projectPath: string;
  timeout?: number;
  onMessage?: (message: ClaudeCodeMessage) => void | Promise<void>;
  onError?: (error: Error) => void;
  onComplete?: (result: ClaudeCodeResult) => void;
}

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
  sessionId?: string;
  totalCost?: number;
  messageCount?: number;
  duration?: number;
}

/**
 * ClaudeCodeExecutor - Responsible ONLY for spawning and managing the Claude Code process
 * 
 * Single Responsibility: Execute Claude Code CLI and stream parsed messages to callbacks
 * - Does NOT publish Nostr events
 * - Does NOT handle business logic
 * - Does NOT decide what to do with messages
 * 
 * The caller decides what to do with the messages via callbacks
 */
export class ClaudeCodeExecutor {
  private process?: ChildProcess;
  private parser: ClaudeParser;
  private stdout = "";
  private startTime: number;

  constructor(private options: ClaudeCodeExecutorOptions) {
    this.parser = new ClaudeParser(options.onMessage);
    this.startTime = Date.now();
  }

  /**
   * Execute Claude Code CLI with the provided prompt
   * Returns a promise that resolves when the process completes
   */
  async execute(): Promise<ClaudeCodeResult> {
    return new Promise((resolve, reject) => {
      const args = [
        "-p",
        "--dangerously-skip-permissions",
        "--output-format",
        "stream-json",
        "--verbose",
        this.options.prompt
      ];

      logger.info("Spawning Claude Code process", {
        cwd: this.options.projectPath,
        promptLength: this.options.prompt.length,
      });

      this.process = spawn("claude", args, {
        cwd: this.options.projectPath,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "inherit"], // ignore stdin, pipe stdout, inherit stderr
      });

      // Set encoding for better string handling
      if (this.process.stdout) {
        this.process.stdout.setEncoding("utf8");
      }

      // Handle stdout - parse JSONL messages
      this.process.stdout?.on("data", (chunk: string) => {
        this.stdout += chunk;
        
        // Parse lines and fire callbacks
        this.parser.parseLines(chunk);
      });

      // stderr is inherited, so it will show directly in console

      // Handle process errors
      this.process.on("error", (error) => {
        const err = new Error(`Failed to spawn Claude Code: ${error.message}`);
        this.options.onError?.(err);
        reject(err);
      });

      // Handle process completion
      this.process.on("close", (code) => {
        const result: ClaudeCodeResult = {
          success: code === 0,
          output: this.stdout,
          error: code !== 0 ? `Claude Code exited with code ${code}` : undefined,
          sessionId: this.parser.getSessionId(),
          totalCost: this.parser.getTotalCost(),
          messageCount: this.parser.getMessageCount(),
          duration: Date.now() - this.startTime,
        };

        if (code !== 0) {
          const error = new Error(`Claude Code exited with code ${code}`);
          this.options.onError?.(error);
          reject(error);
        } else {
          this.options.onComplete?.(result);
          resolve(result);
        }
      });

      // Handle timeout if specified
      if (this.options.timeout) {
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill("SIGTERM");
            const error = new Error("Claude Code execution timed out");
            this.options.onError?.(error);
            reject(error);
          }
        }, this.options.timeout);
      }
    });
  }

  /**
   * Kill the Claude Code process if it's still running
   */
  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
    }
  }

  /**
   * Check if the process is still running
   */
  isRunning(): boolean {
    return this.process ? !this.process.killed : false;
  }
}