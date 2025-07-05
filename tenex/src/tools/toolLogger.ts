import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { ToolExecutionContext, ToolExecutionResult, ToolError } from "./types";
import { matchToolResult } from "./types";

export interface ToolCallLogEntry {
  timestamp: string;
  timestampMs: number;
  requestId: string;

  // Context
  agentName: string;
  phase: string;
  conversationId: string;

  // Tool information
  toolName: string;
  args: Record<string, unknown>;
  argsLength: number;

  // Result
  status: "success" | "error";
  output?: string;
  outputLength?: number;
  error?: string;
  metadata?: Record<string, unknown>;

  // Performance
  performance: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };

  // Trace information
  trace: {
    callStack?: string[];
    parentRequestId?: string;
    batchId?: string;
    batchIndex?: number;
    batchSize?: number;
  };
}

export class ToolCallLogger {
  private readonly logDir: string;

  constructor(projectPath: string) {
    this.logDir = join(projectPath, ".tenex", "logs", "tools");
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if (error instanceof Error && "code" in error && error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return `tool-calls-${date}.jsonl`;
  }

  private getLogFilePath(): string {
    return join(this.logDir, this.getLogFileName());
  }

  private generateRequestId(toolName: string, agentName: string): string {
    return `${agentName}-${toolName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async logToolCall(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
    result: ToolExecutionResult,
    performance: { startTime: number; endTime: number },
    trace?: {
      callStack?: string[];
      parentRequestId?: string;
      batchId?: string;
      batchIndex?: number;
      batchSize?: number;
    }
  ): Promise<void> {
    try {
      await this.ensureLogDirectory();

      const requestId = this.generateRequestId(toolName, context.agent.name);
      const durationMs = performance.endTime - performance.startTime;
      const timestamp = new Date().toISOString();

      const logEntry: ToolCallLogEntry = {
        timestamp,
        timestampMs: performance.startTime,
        requestId,

        // Context
        agentName: context.agent.name,
        phase: context.phase,
        conversationId: context.conversationId,

        // Tool information
        toolName,
        args,
        argsLength: JSON.stringify(args).length,

        // Result
        status: result.success ? "success" : "error",
        output: this.extractOutput(result),
        outputLength: this.extractOutput(result)?.length,
        error: this.extractError(result),
        metadata: this.extractMetadata(result),

        // Performance
        performance: {
          startTime: performance.startTime,
          endTime: performance.endTime,
          durationMs,
        },

        // Trace information
        trace: {
          callStack: trace?.callStack,
          parentRequestId: trace?.parentRequestId,
          batchId: trace?.batchId,
          batchIndex: trace?.batchIndex,
          batchSize: trace?.batchSize,
        },
      };

      // Write to JSONL file
      const logLine = `${JSON.stringify(logEntry)}\n`;
      const logFilePath = this.getLogFilePath();

      await fs.appendFile(logFilePath, logLine, "utf-8");
    } catch (logError) {
      // Don't let logging errors break the main flow
      console.error("[Tool Logger] Failed to log tool call:", logError);
    }
  }

  private extractOutput(result: ToolExecutionResult): string | undefined {
    return matchToolResult(result, {
      pure: (r) => String(r.output),
      effect: (r) => r.success && r.output !== undefined ? String(r.output) : undefined,
      control: (r) => r.success && r.flow ? `Control flow: ${r.flow.type}` : undefined,
      terminal: (r) => {
        if (!r.success || !r.termination) return undefined;
        return r.termination.type === "yield_back" 
          ? r.termination.completion.response
          : r.termination.result.response;
      },
    });
  }

  private extractError(result: ToolExecutionResult): string | undefined {
    return matchToolResult(result, {
      pure: () => undefined, // Pure tools never have errors
      effect: (r) => r.error ? this.formatError(r.error) : undefined,
      control: (r) => r.error ? this.formatError(r.error) : undefined,
      terminal: (r) => r.error ? this.formatError(r.error) : undefined,
    });
  }

  private extractMetadata(result: ToolExecutionResult): Record<string, unknown> | undefined {
    return matchToolResult(result, {
      pure: () => undefined,
      effect: () => undefined,
      control: (r) => r.success && r.flow ? ({ flow: r.flow } as Record<string, unknown>) : undefined,
      terminal: (r) => r.success && r.termination ? ({ termination: r.termination } as Record<string, unknown>) : undefined,
    });
  }

  private formatError(error: ToolError): string {
    switch (error.kind) {
      case "validation":
        return `Validation error in ${error.field}: ${error.message}`;
      case "execution":
        return `Execution error in ${error.tool}: ${error.message}`;
      case "system":
        return `System error: ${error.message}`;
    }
  }
}

// Singleton instance
let globalLogger: ToolCallLogger | null = null;

export function initializeToolLogger(projectPath: string): ToolCallLogger {
  globalLogger = new ToolCallLogger(projectPath);
  return globalLogger;
}

export function getToolLogger(): ToolCallLogger | null {
  return globalLogger;
}
