import type { Tool } from './types';
import { readFileTool } from './implementations/readFile';
import { writeFileTool } from './implementations/writeFile';
import { editFileTool } from './implementations/editFile';
import { shellTool } from './implementations/shell';
import { claudeCodeTool } from './implementations/claudeCode';
import { getCurrentRequirementsTool } from './implementations/getCurrentRequirements';
import { getTimeTool } from './implementations/getTime';
import { nextActionTool } from './implementations/nextAction';

// Registry of all available tools
const toolsMap = new Map<string, Tool>([
  ['read_file', readFileTool],
  ['write_file', writeFileTool],
  ['edit_file', editFileTool],
  ['shell', shellTool],
  ['claude_code', claudeCodeTool],
  ['get_current_requirements', getCurrentRequirementsTool],
  ['get_time', getTimeTool],
  ['next_action', nextActionTool],
]);

export function getTool(name: string): Tool | undefined {
  return toolsMap.get(name);
}

export function getAllTools(): Tool[] {
  // Return unique tools (not aliases)
  return Array.from(toolsMap.values());
}

export function getToolNames(): string[] {
  return Array.from(toolsMap.keys());
}

// Generate tool documentation for agent prompts
export function generateToolDocumentation(): string {
  const tools = getAllTools();
  const docs = tools.map(tool => {
    return `### ${tool.name}\n${tool.instructions}`;
  }).join('\n\n');
  
  return `## Available Tools\n\n${docs}`;
}