import type { ToolExecutor, ToolInvocation, ToolExecutionContext, ToolExecutionResult } from "@/tools/types";
import { RequirementsExtractor } from "@/services/RequirementsExtractor";
import { logger } from "@/utils/logger";
import type { Conversation } from "@/conversations/types";

/**
 * Executor for the get_current_requirements tool
 * Allows the project manager agent to extract and display current requirements from the conversation
 */
export class GetCurrentRequirementsExecutor implements ToolExecutor {
  name = "get_current_requirements";

  async execute(
    invocation: ToolInvocation,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Only the boss agent can get requirements
      if (!context.agent.isBoss) {
        return {
          success: false,
          error: "Permission denied: Only the project manager can get current requirements",
          duration: Date.now() - startTime
        };
      }

      const { conversation } = context;
      
      if (!conversation) {
        return {
          success: false,
          error: "Conversation data not available in context",
          duration: Date.now() - startTime
        };
      }
      
      logger.info("Extracting current requirements from conversation");
      
      const requirements = await RequirementsExtractor.extractRequirements(conversation, context.projectPath);
      
      if (!requirements) {
        return {
          success: true,
          output: "No clear requirements have been discussed yet. Please provide more details about what you'd like to build.",
          duration: Date.now() - startTime,
          metadata: { requirementsFound: false }
        };
      }

      const formattedRequirements = RequirementsExtractor.formatRequirements(requirements);
      
      return {
        success: true,
        output: `Based on our conversation, here are the current requirements:\n\n${formattedRequirements}\n\nPlease let me know if you'd like to modify or add to these requirements.`,
        duration: Date.now() - startTime,
        metadata: {
          requirementsFound: true,
          requirementsSummary: requirements.summary
        }
      };
    } catch (error) {
      logger.error("Failed to get current requirements:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime
      };
    }
  }

  canExecute(toolName: string): boolean {
    return toolName === this.name;
  }
}