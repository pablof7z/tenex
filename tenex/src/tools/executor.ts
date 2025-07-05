/**
 * Tool executor that handles all tool types with proper type safety
 */

import type {
  Tool,
  PureTool,
  EffectTool,
  ControlTool,
  TerminalTool,
  ExecutionContext,
  ControlContext,
  TerminalContext,
  ToolError,
  ControlFlow,
  Termination,
  Validated,
} from "./core";
import { isPureTool, isEffectTool, isControlTool, isTerminalTool } from "./core";
import { EffectInterpreter, defaultCapabilities, type Capabilities } from "./interpreter";
import { logger } from "@/utils/logger";

/**
 * Result of executing a tool
 */
export type ToolExecutionResult<T = unknown> = 
  | PureToolResult<T>
  | EffectToolResult<T>
  | ControlToolResult
  | TerminalToolResult;

interface PureToolResult<T> {
  kind: "pure";
  success: true;
  output: T;
  duration: number;
}

interface EffectToolResult<T> {
  kind: "effect";
  success: boolean;
  output?: T;
  error?: ToolError;
  duration: number;
}

interface ControlToolResult {
  kind: "control";
  success: boolean;
  flow?: ControlFlow;
  error?: ToolError;
  duration: number;
}

interface TerminalToolResult {
  kind: "terminal";
  success: boolean;
  termination?: Termination;
  error?: ToolError;
  duration: number;
}

/**
 * Tool executor with proper type safety and context validation
 */
export class ToolExecutor {
  private readonly interpreter: EffectInterpreter;

  constructor(
    private readonly context: ExecutionContext,
    capabilities: Capabilities = defaultCapabilities
  ) {
    this.interpreter = new EffectInterpreter(context, capabilities);
  }

  /**
   * Execute a tool with the given input
   */
  async execute<I, O>(
    tool: Tool<I, O>,
    input: unknown
  ): Promise<ToolExecutionResult<O>> {
    const startTime = Date.now();

    try {
      // Validate input
      const validationResult = tool.parameters.validate(input);
      if (!validationResult.ok) {
        return this.createErrorResult(tool, validationResult.error, startTime) as ToolExecutionResult<O>;
      }

      const validatedInput = validationResult.value;

      // Execute based on tool type
      if (isPureTool(tool)) {
        const result = this.executePureTool(tool, validatedInput, startTime);
        return Promise.resolve(result as ToolExecutionResult<O>);
      } else if (isEffectTool(tool)) {
        return this.executeEffectTool(tool, validatedInput, startTime);
      } else if (isControlTool(tool)) {
        return this.executeControlTool(tool, validatedInput, startTime);
      } else if (isTerminalTool(tool)) {
        return this.executeTerminalTool(tool, validatedInput, startTime);
      } else {
        // This should never happen due to exhaustive type checking
        const _exhaustiveCheck: never = tool;
        throw new Error(`Unknown tool type`);
      }
    } catch (error) {
      logger.error("Tool execution failed", {
        tool: tool.name,
        error: error instanceof Error ? error.message : String(error),
      });

      return this.createErrorResult(
        tool,
        {
          kind: "system",
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        startTime
      ) as ToolExecutionResult<O>;
    }
  }

  /**
   * Execute a pure tool
   */
  private executePureTool<I, O>(
    tool: PureTool<I, O>,
    input: Validated<I>,
    startTime: number
  ): PureToolResult<O> {
    const output = tool.execute(input);
    return {
      kind: "pure",
      success: true,
      output,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute an effect tool
   */
  private async executeEffectTool<I, O>(
    tool: EffectTool<I, O>,
    input: Validated<I>,
    startTime: number
  ): Promise<EffectToolResult<O>> {
    const effect = tool.execute(input, this.context);
    const result = await this.interpreter.interpret(effect);

    if (result.ok) {
      return {
        kind: "effect",
        success: true,
        output: result.value,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        kind: "effect",
        success: false,
        error: result.error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a control tool (orchestrator only)
   */
  private async executeControlTool<I>(
    tool: ControlTool<I>,
    input: Validated<I>,
    startTime: number
  ): Promise<ControlToolResult> {
    // Validate context is ControlContext
    if (!this.isControlContext(this.context)) {
      return {
        kind: "control",
        success: false,
        error: {
          kind: "execution",
          tool: tool.name,
          message: "Control tools can only be executed by the orchestrator",
        },
        duration: Date.now() - startTime,
      };
    }

    const effect = tool.execute(input, this.context);
    const result = await this.interpreter.interpret(effect);

    if (result.ok) {
      return {
        kind: "control",
        success: true,
        flow: result.value,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        kind: "control",
        success: false,
        error: result.error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute a terminal tool
   */
  private async executeTerminalTool<I>(
    tool: TerminalTool<I>,
    input: Validated<I>,
    startTime: number
  ): Promise<TerminalToolResult> {
    // Validate context is TerminalContext
    if (!this.isTerminalContext(this.context)) {
      return {
        kind: "terminal",
        success: false,
        error: {
          kind: "execution",
          tool: tool.name,
          message: "Terminal tool context is invalid",
        },
        duration: Date.now() - startTime,
      };
    }

    const effect = tool.execute(input, this.context);
    const result = await this.interpreter.interpret(effect);

    if (result.ok) {
      return {
        kind: "terminal",
        success: true,
        termination: result.value,
        duration: Date.now() - startTime,
      };
    } else {
      return {
        kind: "terminal",
        success: false,
        error: result.error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Create an error result for a tool
   */
  private createErrorResult<I, O>(
    tool: Tool<I, O>,
    error: ToolError,
    startTime: number
  ): ToolExecutionResult<O> {
    const duration = Date.now() - startTime;

    if (isPureTool(tool)) {
      // Pure tools should never fail at runtime, this indicates a bug
      throw new Error(`Pure tool ${tool.name} failed: ${error.message}`);
    } else if (isEffectTool(tool)) {
      return { kind: "effect", success: false, error, duration };
    } else if (isControlTool(tool)) {
      return { kind: "control", success: false, error, duration };
    } else {
      return { kind: "terminal", success: false, error, duration };
    }
  }

  /**
   * Type guards for context validation
   */
  private isControlContext(context: ExecutionContext): context is ControlContext {
    return "isOrchestrator" in context && context.isOrchestrator === true;
  }

  private isTerminalContext(context: ExecutionContext): context is TerminalContext {
    return "orchestratorPubkey" in context && "userPubkey" in context;
  }
}

/**
 * Create a tool executor for a given context
 */
export function createToolExecutor(
  context: ExecutionContext,
  capabilities?: Capabilities
): ToolExecutor {
  return new ToolExecutor(context, capabilities);
}

/**
 * Pattern matching for tool results
 */
export function matchToolResult<T>(
  result: ToolExecutionResult,
  handlers: {
    pure: <O>(result: PureToolResult<O>) => T;
    effect: <O>(result: EffectToolResult<O>) => T;
    control: (result: ControlToolResult) => T;
    terminal: (result: TerminalToolResult) => T;
  }
): T {
  switch (result.kind) {
    case "pure":
      return handlers.pure(result);
    case "effect":
      return handlers.effect(result);
    case "control":
      return handlers.control(result);
    case "terminal":
      return handlers.terminal(result);
  }
}