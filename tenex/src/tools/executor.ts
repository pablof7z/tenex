/**
 * Simplified tool executor
 */

import type {
  Tool,
  ExecutionContext,
  ToolError,
} from "./core";
import { logger } from "@/utils/logger";

/**
 * Simple, unified tool execution result
 */
export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: ToolError;
  duration: number;
}

/**
 * Simple tool executor
 */
export class ToolExecutor {
  constructor(private readonly context: ExecutionContext) {}

  /**
   * Execute a tool with the given input
   */
  async execute<I, O>(tool: Tool<I, O>, input: unknown): Promise<ToolExecutionResult<O>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validationResult = tool.parameters.validate(input);
      if (!validationResult.ok) {
        logger.warn(`Tool validation failed for ${tool.name}`, {
          tool: tool.name,
          input,
          error: validationResult.error,
        });
        return {
          success: false,
          error: validationResult.error,
          duration: Date.now() - startTime,
        };
      }

      // Execute the tool
      const result = await tool.execute(validationResult.value, this.context);

      if (result.ok) {
        return {
          success: true,
          output: result.value,
          duration: Date.now() - startTime,
        };
      } else {
        return {
          success: false,
          error: result.error,
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      logger.error("Tool execution failed", {
        tool: tool.name,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: {
          kind: "system",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        duration: Date.now() - startTime,
      };
    }
  }
}

/**
 * Create a tool executor for a given context
 */
export function createToolExecutor(context: ExecutionContext): ToolExecutor {
  return new ToolExecutor(context);
}