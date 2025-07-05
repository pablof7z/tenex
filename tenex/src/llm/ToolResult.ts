/**
 * Serializable representation of tool execution results
 * Preserves type information across LLM boundaries
 * 
 * This is the required format for all tool results passed through
 * the LLM layer to maintain type safety.
 */

import type { ToolExecutionResult, NonEmptyArray } from "@/tools/types";
import { isNonEmptyArray } from "@/tools/core";
import type { Phase } from "@/conversations/phases";
import type { ControlFlow, Termination, ToolError } from "@/tools/core";

/**
 * Serialized tool result that preserves type information
 * This is what gets passed through the LLM layer
 */
export interface SerializedToolResult {
  /** The kind of tool result - preserves the discriminated union type */
  kind: "pure" | "effect" | "control" | "terminal";
  
  /** Whether the tool execution was successful */
  success: boolean;
  
  /** Tool execution duration in milliseconds */
  duration: number;
  
  /** The actual result data - type depends on kind */
  data: {
    // Pure tool data
    output?: unknown;
    
    // Effect tool data
    error?: {
      kind: "validation" | "execution" | "system";
      message: string;
      field?: string;
      tool?: string;
    };
    
    // Control tool data
    flow?: {
      type: "continue" | "delegate" | "fork";
      routing?: {
        phase?: string;
        destinations: string[];
        reason: string;
        message: string;
        context?: { summary?: string };
      };
      // Additional properties for delegate/fork flows
      agents?: string[];
      branches?: Array<{
        agent: string;
        message: string;
      }>;
      message?: string;
      returnToOrchestrator?: boolean;
    };
    
    // Terminal tool data
    termination?: {
      type: "yield_back" | "end_conversation";
      completion?: {
        response: string;
        summary?: string;
        nextAgent?: string;
      };
      result?: {
        response: string;
        summary?: string;
        success: boolean;
      };
    };
  };
}

/**
 * Serialize a typed tool result for LLM transport
 */
export function serializeToolResult(result: ToolExecutionResult): SerializedToolResult {
  const base = {
    kind: result.kind,
    success: result.success,
    duration: result.duration,
  };

  switch (result.kind) {
    case "pure":
      return {
        ...base,
        data: { output: result.output },
      };
      
    case "effect":
      return {
        ...base,
        data: {
          output: result.output,
          error: result.error,
        },
      };
      
    case "control": {
      // Handle different control flow types
      let serializedFlow = undefined;
      if (result.flow) {
        switch (result.flow.type) {
          case "continue":
            serializedFlow = {
              ...result.flow,
              routing: {
                ...result.flow.routing,
                // Convert NonEmptyArray to regular array
                destinations: [...result.flow.routing.destinations],
              },
            };
            break;
          case "delegate":
            serializedFlow = {
              ...result.flow,
              // Convert NonEmptyArray to regular array
              agents: [...result.flow.agents],
            };
            break;
          case "fork":
            serializedFlow = {
              ...result.flow,
              // Convert NonEmptyArray to regular array
              branches: [...result.flow.branches],
            };
            break;
        }
      }
      
      return {
        ...base,
        data: {
          flow: serializedFlow,
          error: result.error,
        },
      };
    }
      
    case "terminal":
      return {
        ...base,
        data: {
          termination: result.termination,
          error: result.error,
        },
      };
  }
}

/**
 * Deserialize a tool result from LLM transport back to typed form
 */
export function deserializeToolResult(serialized: SerializedToolResult): ToolExecutionResult {
  switch (serialized.kind) {
    case "pure":
      return {
        kind: "pure",
        success: true,
        output: serialized.data.output,
        duration: serialized.duration,
      };
      
    case "effect":
      return {
        kind: "effect",
        success: serialized.success,
        output: serialized.data.output,
        error: serialized.data.error ? reconstructError(serialized.data.error) : undefined,
        duration: serialized.duration,
      };
      
    case "control": {
      // Handle different control flow types
      let deserializedFlow = undefined;
      if (serialized.data.flow) {
        const flow = serialized.data.flow;
        switch (flow.type) {
          case "continue":
            // Validate destinations is non-empty
            if (!flow.routing?.destinations || !isNonEmptyArray(flow.routing.destinations)) {
              throw new Error("Continue flow must have non-empty destinations");
            }
            deserializedFlow = {
              ...flow,
              routing: {
                ...flow.routing,
                destinations: flow.routing.destinations,
              },
            };
            break;
          case "delegate":
            // Validate agents is non-empty
            if (!flow.agents || !isNonEmptyArray(flow.agents)) {
              throw new Error("Delegate flow must have non-empty agents");
            }
            deserializedFlow = {
              ...flow,
              agents: flow.agents,
            };
            break;
          case "fork":
            // Validate branches is non-empty
            if (!flow.branches || !isNonEmptyArray(flow.branches)) {
              throw new Error("Fork flow must have non-empty branches");
            }
            deserializedFlow = {
              ...flow,
              branches: flow.branches,
            };
            break;
        }
      }
      
      return {
        kind: "control",
        success: serialized.success,
        flow: deserializedFlow,
        error: serialized.data.error ? reconstructError(serialized.data.error) : undefined,
        duration: serialized.duration,
      };
    }
      
    case "terminal":
      return {
        kind: "terminal",
        success: serialized.success,
        termination: serialized.data.termination,
        error: serialized.data.error ? reconstructError(serialized.data.error) : undefined,
        duration: serialized.duration,
      };
      
    default:
      // This should never happen with proper type checking
      throw new Error(`Unknown tool result kind: ${serialized.kind}`);
  }
}

/**
 * Reconstruct a proper ToolError from serialized data
 */
function reconstructError(error: unknown): ToolError {
  if (!error || typeof error !== 'object') {
    return {
      kind: 'system',
      message: 'Unknown error',
    };
  }
  
  switch (error.kind) {
    case 'validation':
      return {
        kind: 'validation',
        field: error.field || 'unknown',
        message: error.message || 'Validation error',
      };
    case 'execution':
      return {
        kind: 'execution',
        tool: error.tool || 'unknown',
        message: error.message || 'Execution error',
        cause: error.cause,
      };
    case 'system':
      return {
        kind: 'system',
        message: error.message || 'System error',
        stack: error.stack,
      };
    default:
      return {
        kind: 'system',
        message: error.message || 'Unknown error',
      };
  }
}

/**
 * Type guard to check if an object is a SerializedToolResult
 */
export function isSerializedToolResult(obj: unknown): obj is SerializedToolResult {
  if (!obj || typeof obj !== "object") return false;
  
  // Safe property access
  const record = Object(obj);
  
  // Type guard for kind
  if (typeof record.kind !== "string") return false;
  const validKinds = ["pure", "effect", "control", "terminal"];
  if (!validKinds.includes(record.kind)) return false;
  
  // Check other required properties
  return (
    typeof record.success === "boolean" &&
    typeof record.duration === "number" &&
    record.data !== undefined
  );
}