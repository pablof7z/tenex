import { createAgentSystem } from "@/agents";
import type {
  AgentConfig,
  ConversationStore,
  LLMProvider,
  NostrPublisher,
} from "@/agents/core/types";
import { Agent } from "@/agents/domain/Agent";
import { TeamLead } from "@/agents/domain/TeamLead";
import { ProjectLoader } from "@/commands/run/ProjectLoader";
import { getNDK, initNDK } from "@/nostr/ndkClient";
import { readAgentsJson } from "@/utils/agents";
import { formatError } from "@/utils/errors";
import type NDK from "@nostr-dev-kit/ndk";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { readFile } from "@tenex/shared/fs";
import { logError, logInfo } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import chalk from "chalk";

interface DebugSystemPromptOptions {
  agent: string;
}

export async function runDebugSystemPrompt(options: DebugSystemPromptOptions) {
  try {
    const projectPath = process.cwd();
    await initNDK();
    const ndk = getNDK();

    logInfo(`🔍 Debug: Loading system prompt for agent '${options.agent}'`);
    logInfo(chalk.cyan("\n📡 Connecting and loading project...\n"));

    // Load project using real code path
    const projectLoader = new ProjectLoader();
    const projectInfo = await projectLoader.loadProject(projectPath);

    logInfo(`📦 Loaded project: ${projectInfo.title}`);

    // Load agent configurations
    const agentsJson = await readAgentsJson(projectPath);
    const _agentConfigs = new Map<string, AgentConfig>();

    // Load configuration for LLM
    const configuration = await configurationService.loadConfiguration(projectPath);
    const defaultLLMName = configuration.llms?.defaults?.agents || "default";
    const llmConfig = configurationService.resolveConfigReference(
      configuration.llms,
      defaultLLMName
    );

    if (!llmConfig) {
      throw new Error("No LLM configuration found");
    }

    // Find the requested agent
    const agentEntry = Object.entries(agentsJson).find(([name]) => name === options.agent);
    if (!agentEntry) {
      logError(`Agent '${options.agent}' not found in agents.json`);
      logInfo("\nAvailable agents:");
      for (const name of Object.keys(agentsJson)) {
        logInfo(`  - ${name}`);
      }
      process.exit(1);
    }

    const [agentName, agentData] = agentEntry;

    // Load agent definition if available
    let role = `${agentName} specialist`;
    let instructions = `You are the ${agentName} agent for this project.`;

    if (agentData.file) {
      try {
        const agentDefPath = `${projectPath}/.tenex/agents/${agentData.file}`;
        const agentDefContent = await readFile(agentDefPath, "utf-8");
        const agentDef = JSON.parse(agentDefContent);
        role = agentDef.role || role;
        instructions = agentDef.instructions || instructions;
      } catch (_error) {
        logInfo(chalk.yellow(`Could not load agent definition from ${agentData.file}`));
      }
    }

    // Create agent config
    const agentConfig: AgentConfig = {
      name: agentName,
      role,
      instructions,
      nsec: agentData.nsec,
      tools: [], // Add tools if needed
    };

    // Create a mock agent to show its system prompt
    const mockAgent = new Agent(
      agentConfig,
      {} as LLMProvider, // LLM provider not needed for debug
      {} as ConversationStore, // Store not needed
      {} as NostrPublisher, // Publisher not needed
      ndk,
      undefined // Tool registry
    );

    // Get the system prompt
    const systemPrompt = (mockAgent as Agent & { buildSystemPrompt(): string }).buildSystemPrompt();

    // Display the system prompt
    logInfo(chalk.cyan("\n═══════════════════════════════════════════════════════════════"));
    logInfo(chalk.cyan(`System Prompt for Agent: ${chalk.bold(agentName)}`));
    logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════\n"));

    logInfo(systemPrompt);

    logInfo(chalk.cyan("\n═══════════════════════════════════════════════════════════════"));
    logInfo(chalk.green("\n✅ Debug complete"));

    // Exit the process
    process.exit(0);
  } catch (err) {
    const errorMessage = formatError(err);
    logError(`Failed to generate system prompt: ${errorMessage}`);
    process.exit(1);
  }
}
