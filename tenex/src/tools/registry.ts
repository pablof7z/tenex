import { analyze } from "./implementations/analyze";
import { claudeCodeTool } from "./implementations/claudeCode";
import { continueTool } from "./implementations/continue";
import { createMilestoneTaskTool } from "./implementations/createMilestoneTask";
import { endConversationTool } from "./implementations/endConversation";
import { generateInventoryTool } from "./implementations/generateInventory";
import { getTimeTool } from "./implementations/getTime";
import { learnTool } from "./implementations/learn";
import { readFileTool } from "./implementations/readFile";
import { writeContextFileTool } from "./implementations/writeContextFile";
import { yieldBackTool } from "./implementations/yieldBack";
import type { Tool } from "./types";

// Registry of all available tools
const toolsMap = new Map<string, Tool>([
  ["read_file", readFileTool],
  ["write_context_file", writeContextFileTool],
  ["claude_code", claudeCodeTool],
  // ["get_time", getTimeTool],
  ["continue", continueTool],
  ["yield_back", yieldBackTool],
  ["end_conversation", endConversationTool],
  ["analyze", analyze],
  ["generate_inventory", generateInventoryTool],
  ["learn", learnTool],
  ["create_milestone_task", createMilestoneTaskTool],
]);

export function getTool(name: string): Tool | undefined {
  return toolsMap.get(name);
}
