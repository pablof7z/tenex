/**
 * Serializable representation of tool execution results
 * Preserves type information across LLM boundaries
 */

import type { ToolExecutionResult } from "@/tools/types";

/**
 * Simplified serialized tool result
 */
export interface SerializedToolResult {
  /** Whether the tool execution was successful */
  success: boolean;

  /** Tool execution duration in milliseconds */
  duration: number;

  /** The actual result data */
  data: {
    output?: unknown;
    error?: {
      kind: string;
      message: string;
    };
  };
}

/**
 * Serialize a tool result for LLM transport
 */
export function serializeToolResult(result: ToolExecutionResult): SerializedToolResult {
  return {
    success: result.success,
    duration: result.duration,
    data: {
      output: result.output,
      error: result.error ? {
        kind: result.error.kind,
        message: result.error.message,
      } : undefined,
    },
  };
}

/**
 * Check if an object is a serialized tool result
 */
export function isSerializedToolResult(obj: unknown): obj is SerializedToolResult {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "success" in obj &&
    "duration" in obj &&
    "data" in obj &&
    typeof (obj as any).success === "boolean" &&
    typeof (obj as any).duration === "number"
  );
}

/**
 * Deserialize a tool result back to typed format
 */
export function deserializeToolResult(serialized: SerializedToolResult): ToolExecutionResult {
  return {
    success: serialized.success,
    duration: serialized.duration,
    output: serialized.data.output,
    error: serialized.data.error as any,
  };
}