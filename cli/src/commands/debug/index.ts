import type NDK from "@nostr-dev-kit/ndk";
import { logError, logInfo } from "@tenex/shared/logger";
import chalk from "chalk";
import { getNDK } from "../../nostr/ndkClient";
import { AgentManager } from "../../utils/agents/AgentManager";
import { formatError } from "../../utils/errors";
import { ProjectLoader } from "../run/ProjectLoader";

interface DebugSystemPromptOptions {
    agent: string;
}

export async function runDebugSystemPrompt(options: DebugSystemPromptOptions) {
    try {
        const projectPath = process.cwd();
        const ndk = await getNDK();

        logInfo(`🔍 Debug: Loading system prompt for agent '${options.agent}'`);
        console.log(chalk.cyan("\n📡 Connecting and loading project...\n"));

        // Load project using real code path
        const projectLoader = new ProjectLoader(ndk);
        const projectInfo = await projectLoader.loadProject(projectPath);

        logInfo(`📦 Loaded project: ${projectInfo.title}`);

        // Initialize agent manager (same as real system)
        const agentManager = new AgentManager(projectPath, projectInfo);
        agentManager.setNDK(ndk);
        await agentManager.initialize();

        // Get all agent pubkeys for specs loading
        const allAgents = agentManager.getAllAgents();
        const allAuthorPubkeys = [projectInfo.projectPubkey];
        for (const agent of allAgents.values()) {
            allAuthorPubkeys.push(agent.getPubkey());
        }

        // Load specs from all possible authors (same as real subscription)
        await loadSpecsForDebug(projectInfo, allAuthorPubkeys, ndk);

        // Get the specific agent
        const agent = allAgents.get(options.agent);
        if (!agent) {
            const availableAgents = Array.from(allAgents.keys());
            logError(
                `Agent '${options.agent}' not found. Available agents: ${availableAgents.join(", ")}`
            );
            process.exit(1);
        }

        // Use the REAL agent conversation creation with full context
        const context = {
            projectInfo,
            specCache: projectInfo.specCache,
            otherAgents: Array.from(allAgents.entries())
                .filter(([name]) => name !== options.agent)
                .map(([name, agent]) => ({
                    name,
                    description: agent.getConfig().description || "",
                    role: agent.getConfig().role || "",
                })),
            isAgentToAgent: false,
        };

        // Get system prompt using the REAL agent method that the system uses
        const conversation = await agent.getOrCreateConversationWithContext(
            "debug-prompt",
            context
        );

        // Extract the system prompt from the messages
        const messages = conversation.getFormattedMessages();
        const systemMessage = messages.find((msg) => msg.role === "system");
        const systemPrompt = systemMessage?.content || "No system prompt found";

        // Display the result
        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.cyan(`🤖 System Prompt for Agent: ${options.agent}`));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.gray("Agent Pubkey: ") + chalk.white(agent.getPubkey()));
        console.log(chalk.gray("Project: ") + chalk.white(projectInfo.title));
        console.log(
            chalk.gray("Specs Loaded: ") +
                chalk.white(projectInfo.specCache.getAllSpecMetadata().length)
        );
        const toolRegistry = agent.getToolRegistry();
        const toolCount = toolRegistry ? toolRegistry.getAllTools().length : 0;
        console.log(chalk.gray("Tools Available: ") + chalk.white(toolCount));
        console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(`\n${systemPrompt}`);
        console.log(chalk.blue("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));

        logInfo(`✅ System prompt generated successfully (${systemPrompt.length} characters)`);

        // Exit the process
        process.exit(0);
    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to generate system prompt: ${errorMessage}`);
        process.exit(1);
    }
}

async function loadSpecsForDebug(
    projectInfo: import("../run/ProjectLoader").ProjectInfo,
    allAuthorPubkeys: string[],
    ndk: NDK
): Promise<void> {
    try {
        const projectRef = `31933:${projectInfo.projectPubkey}:${projectInfo.projectId}`;

        const filter = {
            kinds: [30023], // NDKArticle
            authors: allAuthorPubkeys, // Project author + all agent pubkeys
            "#a": [projectRef],
            limit: 50,
        };

        logInfo(`📋 Loading specs from ${allAuthorPubkeys.length} possible authors`);
        logInfo(`Project ref: ${projectRef}`);
        logInfo(`Authors: ${allAuthorPubkeys.join(", ")}`);

        const specEvents = await ndk.fetchEvents(filter);
        const eventArray = Array.from(specEvents);

        if (eventArray.length > 0) {
            logInfo(`Found ${eventArray.length} specification document(s)`);
            await projectInfo.specCache.updateSpecs(eventArray);

            // Show loaded spec metadata
            const metadata = projectInfo.specCache.getAllSpecMetadata();
            for (const spec of metadata) {
                logInfo(`  - ${spec.title} (${spec.id}): ${spec.summary || "No summary"}`);
            }
        } else {
            logInfo("No specification documents found");
            logInfo(`Filter used: ${JSON.stringify(filter)}`);
        }
    } catch (error) {
        logError(`Failed to load specs: ${error}`);
    }
}
