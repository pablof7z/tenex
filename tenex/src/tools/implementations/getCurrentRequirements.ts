import type { Tool, ToolExecutionContext, ToolResult } from '../types';
import { RequirementsExtractor } from '@/services/RequirementsExtractor';
import { logger } from '@/utils/logger';

export const getCurrentRequirementsTool: Tool = {
  name: "get_current_requirements",
  instructions: `Retrieve the current project requirements from the conversation context.
Usage: {"tool": "get_current_requirements", "args": {}}
- Returns the extracted requirements from the conversation
- Use this when you need to review what the user has asked for`,
  
  async run(_args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult> {
    if (!context.conversation) {
      return { success: false, error: 'Conversation context is not available.' };
    }

    try {
      const requirements = await RequirementsExtractor.extractRequirements(
        context.conversation,
        context.projectPath
      );

      if (!requirements) {
        return { success: true, output: 'Could not extract any requirements from the conversation yet.' };
      }

      return { success: true, output: RequirementsExtractor.formatRequirements(requirements) };

    } catch (error) {
      logger.error('Failed to get current requirements', { error });
      return { success: false, error: 'An error occurred while extracting requirements.' };
    }
  }
};