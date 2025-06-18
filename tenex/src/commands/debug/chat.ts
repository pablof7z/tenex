import * as fs from "node:fs";
import * as path from "node:path";
import readline from "node:readline";
import { createAgentSystem } from "@/agents";
import type { EventRouter } from "@/agents/application/EventRouter";
import type { AgentConfig, EventContext, NostrPublisher } from "@/agents/core/types";
import { ProjectLoader } from "@/commands/run/ProjectLoader";
import { getNDK, initNDK } from "@/nostr/ndkClient";
import { readAgentsJson } from "@/utils/agents";
import { createAgent } from "@/utils/agents/createAgent";
import { formatError } from "@/utils/errors";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logError, logInfo, logSuccess } from "@tenex/shared/logger";
import { configurationService } from "@tenex/shared/services";
import { EVENT_KINDS } from "@tenex/types/events";
import chalk from "chalk";
import { v4 as uuidv4 } from "uuid";

interface DebugChatOptions {
    systemPrompt?: boolean;
    message?: string;
}

export async function runDebugChat(agentName: string | undefined, options: DebugChatOptions) {
    try {
        const projectPath = process.cwd();
        await initNDK();
        const ndk = getNDK();

        // Load project agents configuration
        const agentsPath = path.join(projectPath, ".tenex", "agents.json");

        if (!fs.existsSync(agentsPath)) {
            logError("No agents configuration found. Please run 'tenex project init' first.");
            process.exit(1);
        }

        const agentsJson = JSON.parse(fs.readFileSync(agentsPath, "utf-8"));
        const availableAgents = Object.keys(agentsJson);

        // If no agent specified, show available agents and exit
        if (!agentName) {
            if (availableAgents.length === 0) {
                logError("No agents found in project configuration.");
                process.exit(1);
            }

            console.log(chalk.cyan("\n✨ Available agents for this project:\n"));
            for (const name of availableAgents) {
                const agentData = agentsJson[name];
                let role = `${name} specialist`;

                // Try to load role from agent definition
                if (agentData.file) {
                    try {
                        const agentDefPath = path.join(
                            projectPath,
                            ".tenex",
                            "agents",
                            agentData.file
                        );
                        if (fs.existsSync(agentDefPath)) {
                            const agentDefContent = JSON.parse(
                                fs.readFileSync(agentDefPath, "utf-8")
                            );
                            role = agentDefContent.metadata?.role || role;
                        }
                    } catch (_) {
                        // Use default role if can't load
                    }
                }

                console.log(chalk.yellow(`  ${name}`) + chalk.gray(` - ${role}`));
            }
            console.log(chalk.gray("\n💡 Usage: tenex debug chat <agent-name>"));
            console.log(chalk.gray("Example: tenex debug chat code\n"));
            process.exit(0);
        }

        // Check if specified agent exists
        if (!agentsJson[agentName]) {
            logError(`Agent '${agentName}' not found in project configuration.`);
            console.log(chalk.gray("\nAvailable agents:"));
            for (const name of availableAgents) {
                console.log(chalk.yellow(`  - ${name}`));
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
        const defaultLLMName = configuration.llms?.defaults?.agents || "default";
        const llmConfig = configurationService.resolveConfigReference(
            configuration.llms,
            defaultLLMName
        );

        if (!llmConfig) {
            throw new Error("No LLM configuration found");
        }

        // Create agent config
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

        const eventRouter = await createAgentSystem({
            projectPath: projectInfo.projectPath,
            projectContext: {
                projectId: projectInfo.projectEvent.id!,
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
            console.log(
                chalk.cyan("\n═══════════════════════════════════════════════════════════════")
            );
            console.log(chalk.cyan("SYSTEM PROMPT"));
            console.log(
                chalk.cyan("═══════════════════════════════════════════════════════════════\n")
            );
            console.log(chalk.gray(systemPrompt));
            console.log(
                chalk.cyan("\n═══════════════════════════════════════════════════════════════\n")
            );
        }

        logSuccess(chalk.green("\n✅ Debug chat initialized successfully"));
        logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════"));
        logInfo(chalk.cyan(`Chat with: ${chalk.bold(agentName)}`));
        logInfo(chalk.cyan(`Project: ${projectInfo.title}`));
        logInfo(chalk.cyan(`Role: ${role}`));
        logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════\n"));

        // Create a debug conversation ID
        const conversationId = `debug-${Date.now()}`;

        // Create a simple publisher that logs responses
        const debugPublisher: NostrPublisher = {
            publishResponse: async (response, _context, _agentSigner) => {
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
            publishTypingIndicator: async (agentName, isTyping, _context, options) => {
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
            await sendDebugMessage(
                eventRouter,
                options.message,
                conversationId,
                projectInfo,
                agentName
            );
        }

        // Start interactive mode
        await startInteractiveMode(eventRouter, conversationId, projectInfo, agentName);
    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to start debug chat: ${errorMessage}`);
        process.exit(1);
    }
}

async function sendDebugMessage(
    eventRouter: EventRouter,
    message: string,
    conversationId: string,
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
                ["conversation", conversationId],
            ],
            created_at: Math.floor(Date.now() / 1000),
        });

        // Set a debug author with a generated signer
        const debugSigner = NDKPrivateKeySigner.generate();
        debugEvent.author = await debugSigner.user();
        debugEvent.id = `debug-${Date.now()}`;
        await debugEvent.sign(debugSigner);

        logInfo(chalk.gray("\n[You]: ") + message);

        // Create context
        const context: EventContext = {
            conversationId,
            projectId: projectInfo.projectEvent.id!,
            originalEvent: debugEvent,
            projectEvent: projectInfo.projectEvent,
        };

        // Process the event - bypass team formation for debug
        const agent = eventRouter.getAgent(agentName);
        if (agent) {
            agent.setActiveSpeaker(true);
            await agent.initialize();

            // Generate and display response
            const response = await agent.generateResponse(debugEvent, context);
            logInfo(chalk.green(`\n[${agent.getName()}]: `) + response.content);
            if (response.signal) {
                logInfo(
                    chalk.gray(
                        `Signal: ${response.signal.type}${response.signal.reason ? ` - ${response.signal.reason}` : ""}`
                    )
                );
            }
        }
    } catch (error) {
        logError(`Failed to send message: ${formatError(error)}`);
    }
}

async function startInteractiveMode(
    eventRouter: EventRouter,
    conversationId: string,
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
            await sendDebugMessage(eventRouter, message, conversationId, projectInfo, agentName);
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
