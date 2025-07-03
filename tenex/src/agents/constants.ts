import { PHASES, type Phase } from "../conversations/phases";
import { analyze } from "../tools/implementations/analyze";
import { claudeCodeTool } from "../tools/implementations/claudeCode";
import { generateInventoryTool } from "../tools/implementations/generateInventory";
import { learnTool } from "../tools/implementations/learn";
import { readFileTool } from "../tools/implementations/readFile";
import { shellTool } from "../tools/implementations/shell";

/**
 * Tools that are only available to the Project Manager (PM) agent
 */
export const PM_ONLY_TOOLS = ["continue", generateInventoryTool.name];

/**
 * Get all available tools for an agent based on their role and phase
 * All agents now have access to all tools except PM-only tools
 */
export function getDefaultToolsForAgent(
  isPMAgent: boolean,
  phase?: Phase,
  isBuiltIn?: boolean
): string[] {
  if (isPMAgent) {
    // PM agents get limited tools (no claude_code or shell)
    const pmTools = [readFileTool.name, analyze.name, "complete", ...PM_ONLY_TOOLS];

    // Add learn tool only during reflection phase
    if (phase === PHASES.REFLECTION) {
      pmTools.push(learnTool.name);
    }

    return pmTools;
  }

  // Built-in agents (planner/executor) only get claude_code and complete
  if (isBuiltIn) {
    const builtInTools = [claudeCodeTool.name, "complete"];

    // Add learn tool only during reflection phase
    if (phase === PHASES.REFLECTION) {
      builtInTools.push(learnTool.name);
    }

    return builtInTools;
  }

  // Other non-PM agents get all base tools
  const baseTools = [
    readFileTool.name,
    shellTool.name,
    claudeCodeTool.name,
    analyze.name,
    "complete",
  ];

  // Add learn tool only during reflection phase
  if (phase === PHASES.REFLECTION) {
    baseTools.push(learnTool.name);
  }

  return baseTools;
}
