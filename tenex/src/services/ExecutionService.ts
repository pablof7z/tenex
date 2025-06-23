import { execSync } from "node:child_process";
import { ClaudeCodeExecutor } from "@/tools/claude/ClaudeCodeExecutor";
import type { ClaudeCodeMessage } from "@/utils/claude/ClaudeParser";
import { logger } from "@/utils/logger";

export interface GitBranchResult {
  branchName: string;
  created: boolean;
}

export interface ClaudeExecutionOptions {
  prompt: string;
  projectPath: string;
  timeout?: number;
  onMessage?: (message: ClaudeCodeMessage) => void | Promise<void>;
  onError?: (error: Error) => void;
  onComplete?: (result: ClaudeExecutionResult) => void;
}

export interface ClaudeExecutionResult {
  success: boolean;
  sessionId?: string;
  totalCost?: number;
  messageCount?: number;
  duration?: number;
  error?: string;
  assistantMessages: string[];
}

/**
 * Shared execution service for git operations and Claude Code execution
 * Extracted from ExecutePhaseInitializer to enable reuse
 */
export class ExecutionService {
  /**
   * Create a git branch for execution
   */
  static createExecutionBranch(baseName: string, projectPath: string = process.cwd()): GitBranchResult {
    try {
      // Check if we're in a git repository
      try {
        execSync("git status", {
          cwd: projectPath,
          stdio: "ignore",
        });
      } catch {
        logger.info("Not a git repository, skipping branch creation");
        return { branchName: "no-git", created: false };
      }

      // Generate branch name
      const safeName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 30);

      const timestamp = Date.now();
      const branchName = `tenex/${safeName}-${timestamp}`;

      // Create and checkout new branch
      execSync(`git checkout -b ${branchName}`, {
        cwd: projectPath,
        stdio: "pipe",
      });

      logger.info("Created execution branch", { branchName });
      return { branchName, created: true };
    } catch (error) {
      logger.error("Failed to create git branch", { error });
      return { branchName: "main", created: false };
    }
  }

  /**
   * Execute Claude Code with the given options
   */
  static async executeClaudeCode(options: ClaudeExecutionOptions): Promise<ClaudeExecutionResult> {
    try {
      logger.info("Executing Claude Code", {
        promptLength: options.prompt.length,
        projectPath: options.projectPath,
      });

      const executor = new ClaudeCodeExecutor({
        prompt: options.prompt,
        projectPath: options.projectPath,
        timeout: options.timeout || 300000, // Default 5 minutes
        onMessage: options.onMessage,
        onError: options.onError,
        onComplete: options.onComplete,
      });

      const result = await executor.execute();

      return {
        success: result.success,
        sessionId: result.sessionId,
        totalCost: result.totalCost,
        messageCount: result.messageCount,
        duration: result.duration,
        error: result.error,
        assistantMessages: result.assistantMessages,
      };
    } catch (error) {
      logger.error("Claude Code execution failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        assistantMessages: [],
      };
    }
  }
}