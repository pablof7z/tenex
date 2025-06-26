import type { Tool } from "./types";
import { readFileTool } from "./implementations/readFile";
import { shellTool } from "./implementations/shell";
import { claudeCodeTool } from "./implementations/claudeCode";
import { getTimeTool } from "./implementations/getTime";
import { switchPhaseTool } from "./implementations/switchPhase";
import { handoffTool } from "./implementations/handoff";
import { analyze } from "./implementations/analyze";
import { generateInventoryTool } from "./implementations/generateInventory";
import { learnTool } from "./implementations/learn";

// Registry of all available tools
const toolsMap = new Map<string, Tool>([
    ["read_file", readFileTool],
    ["shell", shellTool],
    ["claude_code", claudeCodeTool],
    ["get_time", getTimeTool],
    ["switch_phase", switchPhaseTool],
    ["handoff", handoffTool],
    ["analyze", analyze],
    ["generate_inventory", generateInventoryTool],
    ["learn", learnTool],
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
    const docs = tools
        .map((tool) => {
            const params = tool.parameters
                .map(
                    (p) =>
                        `  - ${p.name} (${p.type}${p.required ? ", required" : ", optional"}): ${p.description}`
                )
                .join("\n");

            return `### ${tool.name}
${tool.description}
${params.length > 0 ? `\nParameters:\n${params}` : "\nNo parameters required"}`;
        })
        .join("\n\n");

    return `## Available Tools\n\n${docs}`;
}
