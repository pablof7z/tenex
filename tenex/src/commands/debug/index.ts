import { formatError } from "@/utils/errors";
import { logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";
import { createDebugAgentSystem } from "../../debug/createDebugAgentSystem";

interface DebugSystemPromptOptions {
  agent: string;
}

export async function runDebugSystemPrompt(options: DebugSystemPromptOptions) {
  try {
    const projectPath = process.cwd();

    logInfo(`🔍 Debug: Loading system prompt for agent '${options.agent}'`);

    // Create debug agent system to get the prompt
    const { agent, agentRegistry } = await createDebugAgentSystem({
      projectPath,
      agentName: options.agent,
    });

    // Get agent info from registry
    const agentProfile = agentRegistry.getAgent(options.agent);

    console.log(chalk.cyan("\n=== Agent Information ==="));
    if (agentProfile) {
      console.log(chalk.white("Name:"), agentProfile.name);
      console.log(chalk.white("Role:"), agentProfile.role);
      console.log(chalk.white("Expertise:"), agentProfile.expertise);
      if (agentProfile.tools && agentProfile.tools.length > 0) {
        console.log(chalk.white("Tools:"), agentProfile.tools.join(", "));
      }
    } else {
      console.log(
        chalk.yellow(`Note: Agent '${options.agent}' not found in registry, using default profile`)
      );
    }

    console.log(chalk.cyan("\n=== System Prompt ==="));
    console.log(agent.getSystemPrompt());
    console.log(chalk.cyan("===================\n"));

    logInfo("System prompt displayed successfully");
  } catch (err) {
    const errorMessage = formatError(err);
    logError(`Failed to generate system prompt: ${errorMessage}`);
    process.exit(1);
  }
}
