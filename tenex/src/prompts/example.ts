/**
 * Example usage of the Prompt Building System
 */

import { PromptBuilder } from "./index";

// Example 1: Building an agent prompt
function buildAgentPrompt() {
  const agent = {
    name: "Code Assistant",
    role: "Senior Developer",
    instructions:
      "You are an expert developer who helps users write clean, maintainable code. Focus on best practices and performance.",
  };

  const project = {
    name: "TENEX",
    description: "A decentralized agent orchestration system",
  };

  const tools = ["file", "shell", "search", "git"];

  return new PromptBuilder()
    .add("agent-base", { agent, project })
    .add("project-context", { project, detailed: true })
    .add("available-tools", { tools })
    .build();
}

// Example 2: Building a routing prompt
function buildRoutingPrompt() {
  const availableAgents = ["Code Assistant", "Data Analyst", "Project Manager", "Designer"];

  return new PromptBuilder().add("routing-llm", { availableAgents }).build();
}

// Example 3: Custom fragment with conditional logic
function buildConditionalPrompt(isDevelopment: boolean) {
  const debugFragment = {
    id: "debug-info",
    priority: 100, // High priority = appears later
    template: ({ level }: { level: number }) =>
      `Debug Mode Active - Level ${level}\nExtra logging and error details enabled.`,
  };

  const builder = new PromptBuilder().add("agent-base", {
    agent: {
      name: "System Monitor",
      instructions: "Monitor system health and report issues.",
    },
  });

  // Only add debug info in development
  if (isDevelopment) {
    builder.addFragment(debugFragment, { level: 3 });
  }

  return builder.build();
}

// Example 4: Dynamic prompt composition
function buildDynamicPrompt(config: {
  includeProject?: boolean;
  includeTools?: boolean;
  agent: { name: string; instructions: string };
  project?: { name: string };
  tools?: string[];
}) {
  const builder = new PromptBuilder().add("agent-base", {
    agent: config.agent,
    project: config.project,
  });

  if (config.includeProject && config.project) {
    builder.add("project-context", { project: config.project, detailed: true });
  }

  if (config.includeTools && config.tools) {
    builder.add("available-tools", { tools: config.tools });
  }

  return builder.build();
}

// Run examples
if (require.main === module) {
  console.log("=== Agent Prompt ===");
  console.log(buildAgentPrompt());

  console.log("\n=== Routing Prompt ===");
  console.log(buildRoutingPrompt());

  console.log("\n=== Development Prompt ===");
  console.log(buildConditionalPrompt(true));

  console.log("\n=== Production Prompt ===");
  console.log(buildConditionalPrompt(false));
}
