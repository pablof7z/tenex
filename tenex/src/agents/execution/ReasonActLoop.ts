import type { CompletionResponse, LLMService, Message } from "@/core/llm/types";
import type { TracingContext, TracingLogger } from "@/tracing";
import { createTracingLogger, createToolExecutionContext } from "@/tracing";
import { ToolExecutionManager } from "@/tools/execution";
import type { ToolExecutionResult, ToolInvocation } from "@/types/tool";
import type { Phase } from "@/types/conversation";
import { PromptBuilder } from "@/prompts";

interface ReasonActContext {
  projectPath: string;
  conversationId: string;
  agentName: string;
  phase: Phase;
  llmConfig: string;
}

interface ReasonActResult {
  finalResponse: CompletionResponse;
  finalContent: string;
  allToolResults: ToolExecutionResult[];
}

export class ReasonActLoop {
  private static readonly MAX_ITERATIONS = 3;
  private toolManager = new ToolExecutionManager();

  constructor(private llmService: LLMService) {}

  async execute(
    initialResponse: CompletionResponse,
    context: ReasonActContext,
    systemPrompt: string,
    userPrompt: string,
    tracingContext: TracingContext
  ): Promise<ReasonActResult> {
    const tracingLogger = createTracingLogger(tracingContext, "agent");
    let currentResponse = initialResponse;
    let finalContent = currentResponse.content;
    const allToolResults: ToolExecutionResult[] = [];
    let iteration = 0;

    const toolContext = {
      projectPath: context.projectPath,
      conversationId: context.conversationId,
      agentName: context.agentName,
      phase: context.phase,
    };

    while (iteration < ReasonActLoop.MAX_ITERATIONS) {
      const { enhancedResponse, toolResults, invocations } = await this.toolManager.processResponse(
        currentResponse.content,
        toolContext
      );

      if (invocations.length === 0) {
        tracingLogger.debug("No tool invocations found, completing Reason-Act loop", {
          agent: context.agentName,
          iteration,
        });
        break;
      }

      const mappedResults = this.mapToolResults(toolResults, invocations);
      this.logToolExecutions(invocations, mappedResults, tracingContext);
      allToolResults.push(...mappedResults);

      tracingLogger.info("Tool invocations completed, continuing Reason-Act loop", {
        agent: context.agentName,
        iteration,
        toolCount: invocations.length,
        tools: invocations.map((i) => i.toolName),
      });

      currentResponse = await this.continueWithToolResults(
        context,
        systemPrompt,
        userPrompt,
        currentResponse,
        enhancedResponse,
        mappedResults,
        tracingLogger
      );

      finalContent = currentResponse.content;
      iteration++;
    }

    if (iteration >= ReasonActLoop.MAX_ITERATIONS) {
      tracingLogger.warning("Reason-Act loop reached maximum iterations", {
        agent: context.agentName,
        iterations: ReasonActLoop.MAX_ITERATIONS,
      });
    }

    return {
      finalResponse: currentResponse,
      finalContent,
      allToolResults,
    };
  }

  private mapToolResults(
    toolResults: ToolExecutionResult[],
    invocations: ToolInvocation[]
  ): ToolExecutionResult[] {
    return toolResults.map((result, index) => {
      const invocation = invocations[index];
      return {
        ...result,
        toolName: invocation?.toolName || "unknown",
      };
    });
  }

  private logToolExecutions(
    invocations: ToolInvocation[],
    mappedResults: ToolExecutionResult[],
    tracingContext: TracingContext
  ): void {
    for (const invocation of invocations) {
      const toolTracingContext = createToolExecutionContext(tracingContext, invocation.toolName);
      const toolLogger = createTracingLogger(toolTracingContext, "tools");

      toolLogger.startOperation("tool_execution", {
        tool: invocation.toolName,
        action: invocation.action,
      });

      const toolResult = mappedResults.find((r) => r.toolName === invocation.toolName);

      toolLogger.completeOperation("tool_execution", {
        tool: invocation.toolName,
        success: toolResult?.success || false,
      });
    }
  }

  private async continueWithToolResults(
    context: ReasonActContext,
    systemPrompt: string,
    userPrompt: string,
    currentResponse: CompletionResponse,
    enhancedResponse: string,
    mappedResults: ToolExecutionResult[],
    tracingLogger: TracingLogger
  ): Promise<CompletionResponse> {
    const continuationPrompt = this.buildContinuationPrompt(enhancedResponse, mappedResults);

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
      { role: "assistant", content: currentResponse.content },
      { role: "user", content: continuationPrompt },
    ];

    tracingLogger.logLLMRequest(context.llmConfig);
    const llmStartTime = Date.now();

    const response = await this.llmService.complete({ messages });

    const llmDuration = Date.now() - llmStartTime;
    tracingLogger.logLLMResponse(
      context.llmConfig,
      llmDuration,
      response.usage?.promptTokens,
      response.usage?.completionTokens
    );

    return response;
  }

  private buildContinuationPrompt(
    enhancedResponse: string,
    toolResults: ToolExecutionResult[]
  ): string {
    return new PromptBuilder()
      .add("tool-continuation-prompt", { toolResults })
      .build();
  }
}
