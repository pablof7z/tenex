import readline from "node:readline";
import { createAgentSystem } from "@/agents";
import type { AgentConfig, EventContext } from "@/agents/core/types";
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

interface DebugAgentOptions {
    name: string;
    message?: string;
}

export async function runDebugAgent(options: DebugAgentOptions) {
    try {
        const projectPath = process.cwd();
        await initNDK();
        const ndk = getNDK();

        logInfo(`🔍 Starting debug agent '${options.name}'`);
        logInfo(chalk.cyan("\n📡 Connecting and loading project...\n"));

        // Load project using real code path
        const projectLoader = new ProjectLoader();
        const projectInfo = await projectLoader.loadProject(projectPath);

        logInfo(`📦 Loaded project: ${projectInfo.title}`);

        // Load agent configurations
        const agentsJson = await readAgentsJson(projectPath);
        
        // Check if debug agent exists, create if not
        if (!agentsJson[options.name]) {
            logInfo(chalk.yellow(`\n⚠️  Agent '${options.name}' not found. Creating it...`));
            
            // Create a minimal agent event
            const agentEventId = uuidv4().substring(0, 8);
            await createAgent({
                projectPath,
                projectTitle: projectInfo.title,
                agentName: options.name,
                agentEventId,
                projectEvent: projectInfo.projectEvent,
            });
            
            // Reload agents.json
            const updatedAgentsJson = await readAgentsJson(projectPath);
            agentsJson[options.name] = updatedAgentsJson[options.name];
        }

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
        const agentData = agentsJson[options.name];
        let role = `${options.name} specialist`;
        let instructions = `You are the ${options.name} agent for this project. You are in debug mode and can interact directly with the user.`;

        if (agentData.file) {
            try {
                const agentDefPath = `${projectPath}/.tenex/agents/${agentData.file}`;
                const agentDef = await import(agentDefPath);
                role = agentDef.role || role;
                instructions = agentDef.instructions || instructions;
            } catch (_error) {
                // Use defaults if can't load file
            }
        }

        const agentConfig: AgentConfig = {
            name: options.name,
            role,
            instructions,
            nsec: agentData.nsec,
            tools: [], // Tools will be added by the agent system
        };

        // Create agent system with only the debug agent
        const agentConfigs = new Map<string, AgentConfig>();
        agentConfigs.set(options.name, agentConfig);

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

        logSuccess(chalk.green("\n✅ Debug agent initialized successfully"));
        logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════"));
        logInfo(chalk.cyan(`Debug Agent: ${chalk.bold(options.name)}`));
        logInfo(chalk.cyan(`Project: ${projectInfo.title}`));
        logInfo(chalk.cyan(`Role: ${role}`));
        logInfo(chalk.cyan("═══════════════════════════════════════════════════════════════\n"));

        // Create a debug conversation ID
        const conversationId = `debug-${Date.now()}`;

        // Create a simple publisher that logs responses
        const debugPublisher = {
            ndk,
            publish: async (response: any) => {
                // Display the agent's response
                logInfo(chalk.green(`\n[${options.name}]: `) + response.content);
                if (response.signal) {
                    logInfo(chalk.gray(`Signal: ${response.signal}`));
                }
            }
        };

        // Override the publisher to capture responses
        (eventRouter as any).publisher = debugPublisher;

        // Handle initial message if provided
        if (options.message) {
            await sendDebugMessage(eventRouter, options.message, conversationId, projectInfo);
        }

        // Start interactive mode
        await startInteractiveMode(eventRouter, conversationId, projectInfo, options.name);

    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to start debug agent: ${errorMessage}`);
        process.exit(1);
    }
}

async function sendDebugMessage(
    eventRouter: any,
    message: string,
    conversationId: string,
    projectInfo: any
) {
    try {
        const ndk = getNDK();
        
        // Create a mock chat event
        const debugEvent = new NDKEvent(ndk, {
            kind: EVENT_KINDS.CHAT,
            content: message,
            tags: [
                ["a", `31933:${projectInfo.projectEvent.author.pubkey}:${projectInfo.projectId.split(":")[2]}`],
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
        };

        // Process the event - bypass team formation for debug
        const agent = (eventRouter as any).getAgent((eventRouter as any).agentConfigs.keys().next().value);
        if (agent) {
            agent.setActiveSpeaker(true);
            await agent.initialize();
            
            // Generate and display response
            const response = await agent.generateResponse(debugEvent, context);
            logInfo(chalk.green(`\n[${agent.getName()}]: `) + response.content);
            if (response.signal) {
                logInfo(chalk.gray(`Signal: ${response.signal}`));
            }
        }

    } catch (error) {
        logError(`Failed to send message: ${formatError(error)}`);
    }
}

async function startInteractiveMode(
    eventRouter: any,
    conversationId: string,
    projectInfo: any,
    agentName: string
) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan("\n> "),
    });

    logInfo(chalk.yellow("\n💬 Interactive mode started. Type your messages below:"));
    logInfo(chalk.gray("(Type 'exit' or press Ctrl+C to quit)\n"));

    rl.prompt();

    rl.on("line", async (line) => {
        const message = line.trim();

        if (message.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        if (message) {
            await sendDebugMessage(eventRouter, message, conversationId, projectInfo);
        }

        rl.prompt();
    });

    rl.on("close", () => {
        logInfo(chalk.yellow("\n\n👋 Debug session ended"));
        process.exit(0);
    });

    // Handle Ctrl+C
    process.on("SIGINT", () => {
        rl.close();
    });
}