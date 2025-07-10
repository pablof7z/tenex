import type { Agent } from "./types";
import { analyze } from "../tools/implementations/analyze";
import { continueTool } from "../tools/implementations/continue";
import { endConversationTool } from "../tools/implementations/endConversation";
import { generateInventoryTool } from "../tools/implementations/generateInventory";
import { learnTool } from "../tools/implementations/learn";
import { readFileTool } from "../tools/implementations/readFile";
import { writeContextFileTool } from "@/tools/implementations/writeContextFile";
import { completeTool } from "../tools/implementations/complete";

/**
 * Get all available tools for an agent based on their role
 * All agents now have access to all tools except orchestrator-only tools
 */
export function getDefaultToolsForAgent(agent: Agent): string[] {
  let tools = [readFileTool.name, learnTool.name, analyze.name];

  // Built-in agents
  if (agent.isBuiltIn) {
    if (agent.isOrchestrator) {
      // Orchestrator agents get limited tools (no claude_code or shell)
      tools = [
        endConversationTool.name,
        continueTool.name,
        learnTool.name,
      ];
    } else {
      // Other non-orchestrator agents use complete tool to signal task completion
      tools.push(completeTool.name);

      if (agent.slug === "project-manager") {
        tools.push(generateInventoryTool.name);
        tools.push(writeContextFileTool.name);
      }
    }
  } else {
    // Custom agents default to complete tool
    tools.push(completeTool.name);
  }

  return tools;
}
