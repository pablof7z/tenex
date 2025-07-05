/**
 * Serializable representation of tool execution results
 * Preserves type information across LLM boundaries
 * 
 * This is the required format for all tool results passed through
 * the LLM layer to maintain type safety.
 */

import type { ToolExecutionResult, NonEmptyArray } from "@/tools/types";
import { isNonEmptyArray } from "@/tools/core";

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
      [key: string]: any;
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
      
    case "control":
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
  const base = {
    kind: serialized.kind,
    success: serialized.success,
    duration: serialized.duration,
  };

  switch (serialized.kind) {
    case "pure":
      return {
        ...base,
        kind: "pure",
        output: serialized.data.output,
      } as ToolExecutionResult;
      
    case "effect":
      return {
        ...base,
        kind: "effect",
        output: serialized.data.output,
        error: serialized.data.error,
      } as ToolExecutionResult;
      
    case "control":
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
                destinations: flow.routing.destinations as NonEmptyArray<string>,
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
              agents: flow.agents as NonEmptyArray<string>,
            };
            break;
          case "fork":
            // Validate branches is non-empty
            if (!flow.branches || !isNonEmptyArray(flow.branches)) {
              throw new Error("Fork flow must have non-empty branches");
            }
            deserializedFlow = {
              ...flow,
              branches: flow.branches as NonEmptyArray<any>,
            };
            break;
        }
      }
      
      return {
        ...base,
        kind: "control",
        flow: deserializedFlow,
        error: serialized.data.error,
      } as ToolExecutionResult;
      
    case "terminal":
      return {
        ...base,
        kind: "terminal",
        termination: serialized.data.termination,
        error: serialized.data.error,
      } as ToolExecutionResult;
      
    default:
      // This should never happen with proper type checking
      throw new Error(`Unknown tool result kind: ${serialized.kind}`);
  }
}

/**
 * Type guard to check if an object is a SerializedToolResult
 */
export function isSerializedToolResult(obj: unknown): obj is SerializedToolResult {
  if (!obj || typeof obj !== "object") return false;
  
  const result = obj as Record<string, unknown>;
  return (
    typeof result.kind === "string" &&
    ["pure", "effect", "control", "terminal"].includes(result.kind) &&
    typeof result.success === "boolean" &&
    typeof result.duration === "number" &&
    result.data !== undefined
  );
}