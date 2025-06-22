import { AgentRegistry } from "@/agents/AgentRegistry";
import { buildSystemPrompt } from "@/agents/execution/AgentPromptBuilder";
import { getProjectContext } from "@/runtime";
import { formatError } from "@/utils/errors";
import { logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";

interface DebugSystemPromptOptions {
  agent: string;
}

export async function runDebugSystemPrompt(options: DebugSystemPromptOptions) {
  try {
    const projectPath = process.cwd();

    logInfo(`🔍 Debug: Loading system prompt for agent '${options.agent}'`);

    // Get project context
    const projectContext = await getProjectContext();

    // Load agent from registry
    const agentRegistry = new AgentRegistry(projectPath);
    await agentRegistry.loadFromProject();
    const agent = agentRegistry.getAgent(options.agent);

    console.log(chalk.cyan("\n=== Agent Information ==="));
    if (agent) {
      console.log(chalk.white("Name:"), agent.name);
      console.log(chalk.white("Role:"), agent.role);
      console.log(chalk.white("Expertise:"), agent.expertise);
      if (agent.tools && agent.tools.length > 0) {
        console.log(chalk.white("Tools:"), agent.tools.join(", "));
      }
    } else {
      console.log(chalk.yellow(`Note: Agent '${options.agent}' not found in registry`));
    }

    console.log(chalk.cyan("\n=== System Prompt ==="));

    if (agent) {
      const systemPrompt = await buildSystemPrompt(agent, "chat");
      console.log(systemPrompt);
    } else {
      console.log(chalk.yellow(`Agent '${options.agent}' not found in registry`));
    }

    console.log(chalk.cyan("===================\n"));

    logInfo("System prompt displayed successfully");
  } catch (err) {
    const errorMessage = formatError(err);
    logError(`Failed to generate system prompt: ${errorMessage}`);
    process.exit(1);
  }
}
