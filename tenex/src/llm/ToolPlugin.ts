import { NostrPublisher } from "@/nostr/NostrPublisher";
import { getToolLogger } from "@/tools/toolLogger";
import type {
  PluginParameter as TenexPluginParameter,
  Tool,
  ToolExecutionContext,
} from "@/tools/types";
import { logger } from "@/utils/logger";
import { Plugin, type PluginExecutionContext, type PluginParameter } from "multi-llm-ts";

/**
 * Adapter that converts TENEX Tool to multi-llm-ts Plugin
 * Follows SRP: Only responsible for bridging between Tool and Plugin interfaces
 */
export class ToolPlugin extends Plugin {
  constructor(
    private readonly tool: Tool,
    private readonly tenexContext: ToolExecutionContext
  ) {
    super();
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

  getParameters(): PluginParameter[] {
    // Convert TENEX parameters to multi-llm-ts parameters
    return this.tool.parameters.map(
      (param: TenexPluginParameter): PluginParameter => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required,
        ...(param.enum ? { enum: param.enum } : {}),
      })
    );
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
      // Execute the tool with TENEX context
      const result = await this.tool.execute(parameters, this.tenexContext);
      const endTime = Date.now();

      // Log the successful tool execution
      const toolLogger = getToolLogger();
      if (toolLogger) {
        await toolLogger.logToolCall(
          this.tool.name,
          parameters,
          this.tenexContext,
          {
            success: result.success,
            output: result.output,
            error: result.error,
            duration: endTime - startTime,
          },
          {
            startTime,
            endTime,
          }
        );
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log the failed tool execution
      const toolLogger = getToolLogger();
      if (toolLogger) {
        await toolLogger.logToolCall(
          this.tool.name,
          parameters,
          this.tenexContext,
          {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration,
          },
          {
            startTime,
            endTime,
          }
        );
      }

      // Publish tool failure status
      if (publisher) {
        try {
          await publisher.publishToolStatus({
            tool: this.tool.name,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
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
}
