import type { AgentExecutionContext } from "./types";
import type { ReasonActResult } from "./types";
import type { Tool } from "@/tools/types";

/**
 * Interface for agent execution backends.
 * Different backends can implement different execution strategies
 * (e.g., reason-act loops, direct tool execution, etc.)
 */
export interface ExecutionBackend {
  /**
   * Execute the agent's task with streaming support
   * @param messages - The messages to send to the LLM
   * @param tools - The tools available to the agent
   * @param context - The execution context
   * @returns The result of the execution
   */
  executeStreaming(
    messages: Array<any>,
    tools: Tool[],
    context: AgentExecutionContext
  ): Promise<ReasonActResult>;
}