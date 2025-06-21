import type { ConversationState } from "@/conversations/types";
import { getProjectContext } from "@/runtime";
import type { Agent } from "@/types/agent";
import type { Phase } from "@/types/conversation";
import type { AgentPromptContext } from "./types";
import { InventoryService } from "@/services/InventoryService";
import { logger } from "@tenex/shared";

export async function buildSystemPrompt(agent: Agent, phase: Phase): Promise<string> {
  const projectContext = getProjectContext();
  
  // Build base prompt
  let prompt = `You are ${agent.name}, a ${agent.role} working on the ${projectContext.title} project.

## Your Role
${agent.instructions}

## Your Expertise
${agent.expertise}

## Current Phase: ${phase.toUpperCase()}
${getPhaseInstructions(phase)}

## Project Context
- Project: ${projectContext.title}
${projectContext.repository ? `- Repository: ${projectContext.repository}` : ""}`;

  // Add inventory information for chat phase
  if (phase === "chat") {
    const inventoryPrompt = await getInventoryPrompt(projectContext.projectPath);
    if (inventoryPrompt) {
      prompt += `\n\n${inventoryPrompt}`;
    }
  }

  prompt += `\n\n## Communication Style
- Be concise and focused on the task at hand
- Provide actionable insights and clear next steps
- When suggesting code changes, be specific about what to change
- Ask clarifying questions when requirements are unclear

## Available Tools
${agent.tools.length > 0 ? agent.tools.join(", ") : "No tools assigned"}

${agent.tools.length > 0 ? getToolInstructions() : ""}

Remember: You are currently in the ${phase} phase. Focus your responses accordingly.`;

  return prompt;
}

export function buildConversationContext(
  conversation: ConversationState,
  maxMessages = 10
): string {
  const recentHistory = conversation.history.slice(-maxMessages);

  const context = recentHistory
    .map((event) => {
      const author = event.tags.find((tag) => tag[0] === "p")?.[1] || "User";
      const timestamp = new Date((event.created_at || 0) * 1000).toISOString();
      return `[${timestamp}] ${author}: ${event.content}`;
    })
    .join("\n\n");

  return `## Conversation History (Last ${recentHistory.length} messages)
${context || "No previous messages"}`;
}

export function buildPhaseContext(conversation: ConversationState, phase: Phase): string {
  let context = "";

  switch (phase) {
    case "chat":
      context = `You are in the initial phase. Focus on:
- Quickly understanding the user's request
- Taking immediate action if the request is clear
- Only clarifying when genuinely necessary (request is ambiguous)
- Transitioning to the appropriate phase as soon as possible`;
      break;

    case "plan":
      context = `You are in the planning phase. Focus on:
- Creating a detailed technical plan
- Breaking down the work into milestones
- Identifying dependencies and risks
- Estimating effort and timelines`;
      break;

    case "execute":
      context = `You are in the execution phase. Focus on:
- Implementing the planned features
- Writing clean, maintainable code
- Following best practices
- Communicating progress and blockers`;
      break;

    case "review":
      context = `You are in the review phase. Focus on:
- Evaluating the implementation quality
- Identifying bugs or issues
- Suggesting improvements
- Ensuring requirements are met`;
      break;
  }

  // Add conversation-specific context from metadata
  const phaseKey = `${phase}Context`;
  if (conversation.metadata?.[phaseKey]) {
    context += `\n\n## Additional Context for ${phase} phase:\n${conversation.metadata[phaseKey]}`;
  }

  return context;
}

export function buildToolContext(agent: Agent): string {
  if (agent.tools.length === 0) {
    return "";
  }

  return `## Tool Usage
You have access to the following tools: ${agent.tools.join(", ")}

When you need to use a tool, format your request clearly:
- For file operations: Specify the exact file path and operation
- For shell commands: Provide the complete command with all arguments
- For web searches: Use specific, relevant search terms

Tool results will be automatically executed and included in your response.`;
}

export function buildFullPrompt(context: AgentPromptContext): string {
  return `${context.conversationHistory}

${context.phaseContext}

${context.constraints.length > 0 ? `## Constraints\n${context.constraints.join("\n")}` : ""}

Based on the above context, provide your response as the ${
    context.phaseContext.includes("Phase:") ? "assigned expert" : "project assistant"
  }.`;
}

function getPhaseInstructions(phase: Phase): string {
  switch (phase) {
    case "chat":
      return "Gather requirements and understand the user's needs. Ask clarifying questions to ensure you have all necessary information.";

    case "plan":
      return "Create a detailed implementation plan based on the gathered requirements. Break down the work into manageable tasks.";

    case "execute":
      return "Implement the features according to the plan. Write clean, well-tested code following best practices.";

    case "review":
      return "Review the implementation for quality, security, and completeness. Provide constructive feedback and suggestions.";

    default:
      return "Assist with the current task to the best of your ability.";
  }
}

function getToolInstructions(): string {
  return `## Tool Instructions
When you need to perform actions like:
- Creating or modifying files
- Running shell commands
- Searching the web
- Reading project specifications

Format your tool usage clearly within your response. For example:
- "Let me create a new file..." followed by the file content
- "I'll run this command..." followed by the command
- "Let me search for..." followed by search terms

Tools will be executed automatically and results will be included in your response.`;
}

async function getInventoryPrompt(projectPath: string): Promise<string | null> {
  try {
    const inventoryService = new InventoryService(projectPath);
    const inventoryExists = await inventoryService.inventoryExists();
    
    if (!inventoryExists) {
      logger.debug("No inventory found for project", { projectPath });
      return null;
    }

    // For now, just indicate that inventory exists
    // The actual inventory content will be generated/read by Claude Code
    return `## Project Inventory

An inventory file exists for this project. To get detailed project structure and file information, please refer to the inventory file generated by Claude Code.`;
  } catch (error) {
    logger.warn("Failed to load inventory for agent prompt", { error, projectPath });
    return null;
  }
}
