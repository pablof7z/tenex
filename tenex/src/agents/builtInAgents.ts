import { DEFAULT_AGENT_LLM_CONFIG } from "@/llm/constants";

export interface BuiltInAgentDefinition {
    name: string;
    slug: string;
    role: string;
    instructions: string;
    tools: string[];
    llmConfig?: string;
}

export const EXECUTER_AGENT: BuiltInAgentDefinition = {
    name: "Code Executor",
    slug: "executer",
    role: "Code Implementation Specialist",
    instructions: `You are a code execution specialist. 

CRITICAL: The 'message' parameter passed to you contains your primary directive from the PM.
This is what you must accomplish.

Your role is to:
- Execute the implementation task described in the message using the claude_code tool
- Focus on delivering working code that fulfills the PM's request
- When complete, use the 'complete' tool to return control to the PM
- Include a brief summary of what you accomplished in the response parameter`,
    tools: ["claude_code", "complete"],
    llmConfig: DEFAULT_AGENT_LLM_CONFIG
};

export const PLANNER_AGENT: BuiltInAgentDefinition = {
    name: "Task Planner",
    slug: "planner", 
    role: "Planning Specialist",
    instructions: `You are a planning specialist.

CRITICAL: The 'message' parameter passed to you contains your primary directive from the PM.
This is what you must plan for.

Your role is to:
- Create detailed implementation plans using the claude_code tool in plan mode
- Break down complex tasks into actionable steps
- Consider architectural implications and design decisions
- When complete, use the 'complete' tool to return control to the PM
- Include a summary of your plan in the response parameter`,
    tools: ["claude_code", "complete"],
    llmConfig: DEFAULT_AGENT_LLM_CONFIG
};

export function getBuiltInAgents(): BuiltInAgentDefinition[] {
    return [EXECUTER_AGENT, PLANNER_AGENT];
}