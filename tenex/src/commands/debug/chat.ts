import * as fs from "node:fs";
import * as path from "node:path";
import readline from "node:readline";
import { createAgentSystem } from "@/agents";
import type { EventRouter } from "@/agents/application/EventRouter";
import type { AgentConfig, EventContext, LLMConfig, NostrPublisher } from "@/agents/core/types";
import { ProjectLoader } from "@/commands/run/ProjectLoader";
import { getNDK, initNDK } from "@/nostr/ndkClient";
import { formatError } from "@/utils/errors";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logError, logInfo, logSuccess } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";
import inquirer from "inquirer";

interface DebugChatOptions {
  systemPrompt?: boolean;
  message?: string;
  llm?: string | boolean; // string if config name provided, true if flag used without value
}

export async function runDebugChat(
  initialAgentName: string | undefined,
  options: DebugChatOptions
) {
  try {
    const projectPath = process.cwd();
    await initNDK();

    // Load project agents configuration
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");

    if (!fs.existsSync(agentsPath)) {
      logError("No agents configuration found. Please run 'tenex project init' first.");
      process.exit(1);
    }

    const agentsJson = JSON.parse(fs.readFileSync(agentsPath, "utf-8"));
    const availableAgents = Object.keys(agentsJson);

    let agentName = initialAgentName;

    // If user wants to see LLM configurations and no agent specified
    if (options.llm === true && !agentName) {
      // Load configuration to show LLM options
      const configuration = await configurationService.loadConfiguration(projectPath);
      const availableConfigs = Object.keys(configuration.llms.configurations);

      if (availableConfigs.length === 0) {
        logError("No LLM configurations found in project.");
        process.exit(1);
      }

      // Create choices for inquirer
      const llmChoices = availableConfigs.map((configName) => {
        const config = configuration.llms.configurations[configName];
        const isDefault = configuration.llms.defaults.default === configName;
        const agentDefault = Object.entries(configuration.llms.defaults)
          .filter(([agent, llm]) => agent !== "default" && llm === configName)
          .map(([agent]) => agent);

        let name = `${configName} (${config?.provider}/${config?.model})`;
        if (isDefault) name += chalk.green(" [default]");
        if (agentDefault.length > 0) {
          name += chalk.gray(` [default for: ${agentDefault.join(", ")}]`);
        }

        return {
          name,
          value: configName,
          short: configName,
        };
      });

      logInfo(chalk.cyan("\n✨ Select LLM configuration:\n"));

      const { selectedLLM } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedLLM",
          message: "Choose an LLM configuration:",
          choices: llmChoices,
          loop: false,
        },
      ]);

      // Set the selected LLM in options
      options.llm = selectedLLM;

      // Continue to agent selection
      logInfo(`Selected LLM configuration: ${chalk.yellow(selectedLLM)}`);
    }

    // If no agent specified, show available agents and let user select
    if (!agentName) {
      if (availableAgents.length === 0) {
        logError("No agents found in project configuration.");
        process.exit(1);
      }

      // Create choices for inquirer
      const agentChoices = availableAgents.map((name) => {
        const agentData = agentsJson[name];
        let role = `${name} specialist`;

        // Try to load role from agent definition
        if (agentData.file) {
          try {
            const agentDefPath = path.join(projectPath, ".tenex", "agents", agentData.file);
            if (fs.existsSync(agentDefPath)) {
              const agentDefContent = JSON.parse(fs.readFileSync(agentDefPath, "utf-8"));
              role = agentDefContent.metadata?.role || role;
            }
          } catch (_) {
            // Use default role if can't load
          }
        }

        return {
          name: `${name} - ${chalk.gray(role)}`,
          value: name,
          short: name,
        };
      });

      logInfo(chalk.cyan("\n✨ Select an agent for debug chat:\n"));

      const { selectedAgent } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedAgent",
          message: "Choose an agent:",
          choices: agentChoices,
          loop: false,
        },
      ]);

      agentName = selectedAgent;
      logInfo(`Selected agent: ${chalk.yellow(selectedAgent)}`);
    }

    // Check if specified agent exists
    if (!agentName || !agentsJson[agentName]) {
      logError(`Agent '${agentName}' not found in project configuration.`);
      logInfo(chalk.gray("\nAvailable agents:"));
      for (const name of availableAgents) {
        logInfo(chalk.yellow(`  - ${name}`));
      }
      process.exit(1);
    }

    logInfo(`🔍 Starting debug chat with agent '${agentName}'`);
    logInfo(chalk.cyan("\n📡 Connecting and loading project...\n"));

    // Load project using real code path
    const projectLoader = new ProjectLoader();
    const projectInfo = await projectLoader.loadProject(projectPath);

    logInfo(`📦 Loaded project: ${projectInfo.title}`);

    // Load configuration for LLM
    const configuration = await configurationService.loadConfiguration(projectPath);

    // Handle LLM configuration selection
    let selectedLLMConfig: LLMConfig | undefined;

    if (options.llm === true) {
      // User provided --llm flag without value, show interactive selection
      const availableConfigs = Object.keys(configuration.llms.configurations);

      if (availableConfigs.length === 0) {
        logError("No LLM configurations found in project.");
        process.exit(1);
      }

      // Create choices for inquirer
      const llmChoices = availableConfigs.map((configName) => {
        const config = configuration.llms.configurations[configName];
        const isDefault = configuration.llms.defaults.default === configName;
        const isAgentDefault = initialAgentName
          ? configuration.llms.defaults[initialAgentName] === configName
          : false;
        const agentDefault = Object.entries(configuration.llms.defaults)
          .filter(([agent, llm]) => agent !== "default" && llm === configName)
          .map(([agent]) => agent);

        let name = `${configName} (${config?.provider}/${config?.model})`;
        if (isAgentDefault) {
          name += chalk.green(` [default for ${initialAgentName}]`);
        } else if (isDefault) {
          name += chalk.green(" [global default]");
        }
        if (agentDefault.length > 0 && !isAgentDefault) {
          name += chalk.gray(` [default for: ${agentDefault.join(", ")}]`);
        }

        return {
          name,
          value: configName,
          short: configName,
        };
      });

      logInfo(chalk.cyan("\n✨ Select LLM configuration:\n"));

      const { selectedLLM } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedLLM",
          message: "Choose an LLM configuration:",
          choices: llmChoices,
          loop: false,
        },
      ]);

      selectedLLMConfig = configurationService.resolveConfigReference(
        configuration.llms,
        selectedLLM
      );

      logInfo(`📡 Using LLM configuration: ${chalk.yellow(selectedLLM)}`);
    } else if (typeof options.llm === "string") {
      // User provided a specific LLM configuration name
      selectedLLMConfig = configurationService.resolveConfigReference(
        configuration.llms,
        options.llm
      );

      if (!selectedLLMConfig) {
        logError(`LLM configuration '${options.llm}' not found.`);
        logInfo(chalk.gray("\nAvailable configurations:"));
        for (const name of Object.keys(configuration.llms.configurations)) {
          logInfo(chalk.yellow(`  - ${name}`));
        }
        process.exit(1);
      }

      logInfo(`📡 Using LLM configuration: ${chalk.yellow(options.llm)}`);
    } else {
      // No --llm flag provided, use default for the agent
      const agentDefaultName =
        (agentName && configuration.llms?.defaults?.[agentName]) ||
        configuration.llms?.defaults?.default ||
        "default";
      selectedLLMConfig = configurationService.resolveConfigReference(
        configuration.llms,
        agentDefaultName
      );

      if (!selectedLLMConfig) {
        throw new Error("No LLM configuration found");
      }
    }

    const llmConfig = selectedLLMConfig;

    // Create agent config
    if (!agentName) {
      throw new Error("No agent selected");
    }

    const agentData = agentsJson[agentName];
    let role = `${agentName} specialist`;
    let instructions = `You are the ${agentName} agent for this project.`;

    if (agentData.file) {
      try {
        const agentDefPath = `${projectPath}/.tenex/agents/${agentData.file}`;
        const agentDefContent = JSON.parse(fs.readFileSync(agentDefPath, "utf-8"));
        role = agentDefContent.metadata?.role || role;
        instructions = agentDefContent.metadata?.instructions || instructions;
      } catch (_error) {
        // Use defaults if can't load file
      }
    }

    const agentConfig: AgentConfig = {
      name: agentName,
      role,
      instructions,
      nsec: agentData.nsec,
      tools: [], // Tools will be added by the agent system
    };

    // Create agent system with only the debug agent
    const agentConfigs = new Map<string, AgentConfig>();
    agentConfigs.set(agentName, agentConfig);

    if (!projectInfo.projectEvent.id) {
      throw new Error("Project event ID is required but was not found");
    }

    const eventRouter = await createAgentSystem({
      projectPath: projectInfo.projectPath,
      projectContext: {
        projectId: projectInfo.projectEvent.id,
        title: projectInfo.title,
        description: projectInfo.projectEvent.content,
        repository: projectInfo.repository,
      },
      projectEvent: projectInfo.projectEvent,
      agents: agentConfigs,
      llmConfig,
      ndk: getNDK(),
    });

    // Get the agent for system prompt display
    const agent = eventRouter.getAgent(agentName);

    // Show system prompt if requested
    if (options.systemPrompt && agent) {
      await agent.initialize();
      const systemPrompt = agent.getSystemPrompt();
      logInfo(chalk.cyan("\n═══════════════════════════════════════════════════════════════"));
      logInfo(chalk.cyan("SYSTEM PROMPT"));
      logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════\n"));
      logInfo(chalk.gray(systemPrompt));
      logInfo(chalk.cyan("\n═══════════════════════════════════════════════════════════════\n"));
    }

    logSuccess(chalk.green("\n✅ Debug chat initialized successfully"));
    logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════"));
    logInfo(chalk.cyan(`Chat with: ${chalk.bold(agentName)}`));
    logInfo(chalk.cyan(`Project: ${projectInfo.title}`));
    logInfo(chalk.cyan(`Role: ${role}`));
    logInfo(chalk.cyan(`LLM: ${llmConfig.provider}/${llmConfig.model}`));
    logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════\n"));

    // Create a debug root event ID
    const rootEventId = `debug-${Date.now()}`;

    // Create a simple publisher that logs responses
    const debugPublisher: NostrPublisher = {
      publishResponse: async (response, _context, _agentSigner, _agentName) => {
        // Display the agent's response
        logInfo(chalk.green(`\n[${agentName}]: `) + response.content);
        if (response.signal) {
          logInfo(
            chalk.gray(
              `Signal: ${response.signal.type}${response.signal.reason ? ` - ${response.signal.reason}` : ""}`
            )
          );
        }
      },
      publishTypingIndicator: async (agentName, isTyping, _context, _signer, options) => {
        // Log typing indicator for debug purposes
        if (isTyping) {
          logInfo(chalk.gray(`[${agentName} is typing...]`));
          if (options?.userPrompt) {
            logInfo(chalk.gray(`Processing: "${options.userPrompt.substring(0, 50)}..."`));
          }
        }
      },
    };

    // Override the publisher to capture responses
    eventRouter.setPublisher(debugPublisher);

    // Handle initial message if provided
    if (options.message) {
      await sendDebugMessage(eventRouter, options.message, rootEventId, projectInfo, agentName);
    }

    // Start interactive mode
    await startInteractiveMode(eventRouter, rootEventId, projectInfo, agentName);
  } catch (err) {
    const errorMessage = formatError(err);
    logError(`Failed to start debug chat: ${errorMessage}`);
    process.exit(1);
  }
}

async function sendDebugMessage(
  eventRouter: EventRouter,
  message: string,
  rootEventId: string,
  projectInfo: import("../run/ProjectLoader").ProjectRuntimeInfo,
  agentName: string
) {
  try {
    const ndk = getNDK();

    // Create a mock chat event
    const debugEvent = new NDKEvent(ndk, {
      kind: EVENT_KINDS.CHAT,
      content: message,
      tags: [
        [
          "a",
          `31933:${projectInfo.projectEvent.author.pubkey}:${projectInfo.projectId.split(":")[2]}`,
        ],
        ["conversation", rootEventId],
      ],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Set a debug author with a generated signer
    const debugSigner = NDKPrivateKeySigner.generate();
    debugEvent.author = await debugSigner.user();
    debugEvent.id = `debug-${Date.now()}`;
    await debugEvent.sign(debugSigner);

    logInfo(chalk.gray("\n[You]: ") + message);

    if (!projectInfo.projectEvent.id) {
      throw new Error("Project event ID is required but was not found");
    }

    // Create context
    const context: EventContext = {
      rootEventId,
      projectId: projectInfo.projectEvent.id,
      originalEvent: debugEvent,
      projectEvent: projectInfo.projectEvent,
    };

    // Process the event - bypass team formation for debug
    const agent = eventRouter.getAgent(agentName);
    if (agent) {
      agent.setActiveSpeaker(true);
      await agent.initialize();

      // Use handleEvent instead of generateResponse to ensure tools are executed
      await agent.handleEvent(debugEvent, context);
    }
  } catch (error) {
    logError(`Failed to send message: ${formatError(error)}`);
  }
}

async function startInteractiveMode(
  eventRouter: EventRouter,
  rootEventId: string,
  projectInfo: import("../run/ProjectLoader").ProjectRuntimeInfo,
  agentName: string
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("\n> "),
  });

  logInfo(chalk.yellow("\n💬 Interactive chat started. Type your messages below:"));
  logInfo(chalk.gray("(Type 'exit' or press Ctrl+C to quit)\n"));

  rl.prompt();

  rl.on("line", async (line) => {
    const message = line.trim();

    if (message.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    if (message) {
      await sendDebugMessage(eventRouter, message, rootEventId, projectInfo, agentName);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    logInfo(chalk.yellow("\n\n👋 Chat session ended"));
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    rl.close();
  });
}
