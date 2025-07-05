import { NostrPublisher } from "@/nostr/NostrPublisher";
import { getToolLogger } from "@/tools/toolLogger";
import type {
  Tool,
  ToolExecutionContext,
  ToolExecutor,
  ToolError,
  ToolExecutionResult,
} from "@/tools/types";
import { createToolExecutor, matchToolResult } from "@/tools/types";
import { logger } from "@/utils/logger";
import {
  Plugin,
  type PluginExecutionContext,
  type PluginParameter as MultiLLMPluginParameter,
} from "multi-llm-ts";
import { serializeToolResult } from "./ToolResult";

/**
 * Adapter that converts TENEX Tool to multi-llm-ts Plugin
 * Handles all tool types: Pure, Effect, Control, Terminal
 */
export class ToolPlugin extends Plugin {
  private readonly executor: ToolExecutor;

  constructor(
    private readonly tool: Tool,
    private readonly tenexContext: ToolExecutionContext
  ) {
    super();
    // Create executor with appropriate capabilities
    this.executor = createToolExecutor(tenexContext);
  }

  serializeInTools(): boolean {
    return true;
  }

  isEnabled(): boolean {
    return true;
  }

  getName(): string {
    return this.tool.name;
  }

  getDescription(): string {
    return this.tool.description;
  }

  getParameters(): MultiLLMPluginParameter[] {
    // Extract parameter info from schema shape
    const shape = this.tool.parameters.shape;

    if (shape.type === "object" && shape.properties) {
      return Object.entries(shape.properties).map(([name, prop]) => {
        const param: MultiLLMPluginParameter = {
          name,
          type: this.mapSchemaTypeToPluginType(prop.type),
          description: prop.description,
          required: true, // TODO: Handle optional fields from schema
        };

        if (prop.type === "string" && prop.enum) {
          param.enum = [...prop.enum]; // Convert readonly to mutable
        }

        return param;
      });
    }

    // Fallback for non-object schemas
    return [];
  }

  private mapSchemaTypeToPluginType(
    schemaType: string
  ): "string" | "number" | "boolean" | "object" | "array" {
    switch (schemaType) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return "array";
      case "object":
        return "object";
      default:
        return "string";
    }
  }

  getPreparationDescription(_tool: string): string {
    return `Preparing ${this.tool.name}...`;
  }

  getRunningDescription(_tool: string, args: Record<string, unknown>): string {
    const argsStr = Object.keys(args).length > 0 ? ` with ${JSON.stringify(args)}` : "";
    return `Running ${this.tool.name}${argsStr}`;
  }

  getCompletedDescription(
    _tool: string,
    _args: Record<string, unknown>,
    _results: unknown
  ): string {
    return `Completed ${this.tool.name}`;
  }

  async execute(
    _context: PluginExecutionContext,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    const startTime = Date.now();
    let publisher: NostrPublisher | undefined;

    // Create publisher if we have the necessary context
    if (
      this.tenexContext.triggeringEvent &&
      this.tenexContext.agent &&
      this.tenexContext.conversation
    ) {
      try {
        publisher = new NostrPublisher({
          conversation: this.tenexContext.conversation,
          agent: this.tenexContext.agent,
          triggeringEvent: this.tenexContext.triggeringEvent,
        });

        await publisher.publishToolStatus({
          tool: this.tool.name,
          status: "starting",
          args: parameters,
        });

        logger.debug("Published tool execution start", {
          tool: this.tool.name,
          agent: this.tenexContext.agent.name,
        });
      } catch (error) {
        logger.error("Failed to publish tool execution start", {
          tool: this.tool.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - tool execution should continue even if publishing fails
      }
    }

    try {
      // Execute the tool using the type-safe executor
      const result = await this.executor.execute(this.tool, parameters);
      const endTime = Date.now();

      // Serialize the typed result for transport through LLM layer
      const serializedResult = serializeToolResult(result);

      // Create a human-readable output message
      const outputMessage = matchToolResult(result, {
        pure: (r) => String(r.output),
        effect: (r) => (r.success && r.output !== undefined ? String(r.output) : ""),
        control: (r) => {
          if (!r.success || !r.flow) return "Control flow failed";
          if (r.flow.type === "continue") {
            return `Routing to ${r.flow.routing.destinations.length} agents`;
          }
          return `Control flow: ${r.flow.type}`;
        },
        terminal: (r) => {
          if (!r.success || !r.termination) return "Termination failed";
          if (r.termination.type === "yield_back") {
            return r.termination.completion.response;
          }if (r.termination.type === "end_conversation") {
            return r.termination.result.response;
          }
          return "Execution terminated";
        },
      });

      // Extract error message if present (error is not on all result types)
      const errorMessage = matchToolResult(result, {
        pure: () => undefined,
        effect: (r) => (r.error ? this.formatError(r.error) : undefined),
        control: (r) => (r.error ? this.formatError(r.error) : undefined),
        terminal: (r) => (r.error ? this.formatError(r.error) : undefined),
      });

      // Return both serialized result and human-readable output
      const processedResult = {
        success: result.success,
        output: outputMessage,
        error: errorMessage,
        duration: result.duration,
        // Include the full typed result for ReasonActLoop
        __typedResult: serializedResult,
      };

      // Log the successful tool execution
      const toolLogger = getToolLogger();
      if (toolLogger) {
        await toolLogger.logToolCall(
          this.tool.name,
          parameters,
          this.tenexContext,
          result, // Pass the original typed result
          {
            startTime,
            endTime,
          }
        );
      }

      // Publish completion status
      if (publisher && processedResult.success) {
        try {
          await publisher.publishToolStatus({
            tool: this.tool.name,
            status: "completed",
            result: processedResult,
            duration: result.duration,
          });
        } catch (publishError) {
          logger.error("Failed to publish tool completion", {
            tool: this.tool.name,
            error: publishError instanceof Error ? publishError.message : String(publishError),
          });
        }
      }

      return processedResult;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Create an error result for logging
      const errorResult: ToolExecutionResult = {
        kind: "effect",
        success: false,
        output: undefined,
        error: {
          kind: "execution",
          tool: this.tool.name,
          message: error instanceof Error ? error.message : String(error),
        },
        duration,
      };

      // Log the failed tool execution
      const toolLogger = getToolLogger();
      if (toolLogger) {
        await toolLogger.logToolCall(this.tool.name, parameters, this.tenexContext, errorResult, {
          startTime,
          endTime,
        });
      }

      // Publish tool failure status
      if (publisher) {
        try {
          await publisher.publishToolStatus({
            tool: this.tool.name,
            status: "failed",
            error: errorResult.error ? this.formatError(errorResult.error) : "Unknown error",
            duration,
          });

          logger.debug("Published tool execution failure", {
            tool: this.tool.name,
            agent: this.tenexContext.agent.name,
            error: error instanceof Error ? error.message : String(error),
            duration,
          });
        } catch (publishError) {
          logger.error("Failed to publish tool execution failure", {
            tool: this.tool.name,
            error: publishError instanceof Error ? publishError.message : String(publishError),
          });
        }
      }

      // Re-throw the original error
      throw error;
    }
  }

  private formatError(error: ToolError): string {
    switch (error.kind) {
      case "validation":
        return `Validation error in field '${error.field}': ${error.message}`;
      case "execution":
        return `Execution error in tool '${error.tool}': ${error.message}`;
      case "system":
        return `System error: ${error.message}`;
    }
  }
}
