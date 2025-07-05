import type { Phase } from "../conversations/phases";
import { analyze } from "../tools/implementations/analyze";
import { claudeCodeTool } from "../tools/implementations/claudeCode";
import { continueTool } from "../tools/implementations/continue";
import { endConversationTool } from "../tools/implementations/endConversation";
import { generateInventoryTool } from "../tools/implementations/generateInventory";
import { learnTool } from "../tools/implementations/learn";
import { readFileTool } from "../tools/implementations/readFile";
import { writeContextFileTool } from "@/tools/implementations/writeContextFile";
import { yieldBackTool } from "../tools/implementations/yieldBack";

/**
 * Get all available tools for an agent based on their role and phase
 * All agents now have access to all tools except orchestrator-only tools
 */
export function getDefaultToolsForAgent(
  isOrchestrator: boolean,
  phase?: Phase,
  isBuiltIn?: boolean,
  agentSlug?: string
): string[] {
  let tools = [readFileTool.name, learnTool.name, analyze.name];

  // Built-in agents
  if (isBuiltIn) {
    if (isOrchestrator) {
      // Orchestrator agents get limited tools (no claude_code or shell)
      tools = [analyze.name, endConversationTool.name, continueTool.name, generateInventoryTool.name];
    } else {
      // Non-orchestrator agents use yield_back instead of complete
      tools.push(claudeCodeTool.name, yieldBackTool.name);
  
      if (agentSlug === 'project-manager') {
        tools.push(generateInventoryTool.name);
        tools.push(writeContextFileTool.name);
      }
    }
  } else {
    // Custom agents default to yield_back
    tools.push(yieldBackTool.name);
  }

  return tools;
}
