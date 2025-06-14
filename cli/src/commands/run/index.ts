import type NDK from "@nostr-dev-kit/ndk";
import { logError, logInfo, logSuccess } from "@tenex/shared/logger";
import chalk from "chalk";
import { getNDK } from "../../nostr/ndkClient";
import { getAgentSigner } from "../../utils/agentManager";
import { formatError } from "../../utils/errors";
import { EventHandler } from "./EventHandler";
import { ProjectDisplay } from "./ProjectDisplay";
import { type ProjectInfo, ProjectLoader } from "./ProjectLoader";
import { StatusPublisher } from "./StatusPublisher";
import { STARTUP_FILTER_MINUTES } from "./constants";

export async function runTask() {
    try {
        const projectPath = process.cwd();
        const ndk = await getNDK();

        logInfo("Starting TENEX project listener...");
        console.log(chalk.cyan("\n📡 Fetching project event...\n"));

        // Load project
        const projectLoader = new ProjectLoader(ndk);
        const projectInfo = await projectLoader.loadProject(projectPath);

        // Display basic project information (documentation shown after subscription EOSE)
        const projectDisplay = new ProjectDisplay(ndk);
        await projectDisplay.displayProjectInfo(projectInfo);

        // Start the project listener
        await runProjectListener(projectInfo, ndk);
    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to start project: ${errorMessage}`);
        process.exit(1);
    }
}


async function runProjectListener(projectInfo: ProjectInfo, ndk: NDK) {
    try {
        logInfo(`Starting listener for project: ${projectInfo.title} (${projectInfo.projectId})`);

        // Set up agent signer
        const { signer } = await getAgentSigner(projectInfo.projectPath, "default");
        ndk.signer = signer;

        // Initialize event handler
        const eventHandler = new EventHandler(projectInfo, ndk);
        await eventHandler.initialize();

        // Start status publisher
        const statusPublisher = new StatusPublisher(ndk);
        await statusPublisher.startPublishing(projectInfo);

        // Get all agent pubkeys for specs filter
        const allAgents = eventHandler.getAllAgents();
        const allAuthorPubkeys = [projectInfo.projectPubkey];
        for (const agent of allAgents.values()) {
            allAuthorPubkeys.push(agent.getPubkey());
        }

        // Set up event subscription
        const startupFilterTimestamp = Math.floor(Date.now() / 1000) - STARTUP_FILTER_MINUTES * 60;
        logInfo(
            `Filtering events from the last ${STARTUP_FILTER_MINUTES} minutes (since timestamp: ${startupFilterTimestamp})`
        );

        // Create filters for project events, project-referencing events, and specs
        const projectRefFilter = projectInfo.projectEvent.filter();
        projectRefFilter.since = startupFilterTimestamp;

        const projectEventFilter = {
            kinds: [31933],
            authors: [projectInfo.projectPubkey],
            "#d": [projectInfo.projectId],
        };

        const projectRef = `31933:${projectInfo.projectPubkey}:${projectInfo.projectId}`;
        const specsFilter = {
            kinds: [30023], // NDKArticle
            authors: allAuthorPubkeys, // Project author + all agent pubkeys
            "#a": [projectRef],
        };

        // Subscribe to project events, project-referencing events, and specs
        const sub = ndk.subscribe(
            [projectRefFilter, projectEventFilter, specsFilter],
            { closeOnEose: false },
            {
                onEvent: async (event) => {
                    // Handle spec events (NDKArticle kind 30023)
                    if (event.kind === 30023) {
                        await projectInfo.specCache.updateSpecs([event]);
                        logInfo(
                            `Updated spec cache with new/updated specification: ${event.tags.find((t) => t[0] === "d")?.[1] || event.id}`
                        );
                    } else {
                        // Handle other project events
                        await eventHandler.handleEvent(event);
                    }
                },
                onEose: async () => {
                    // Display documentation after all initial events are loaded
                    const projectDisplay = new ProjectDisplay(ndk);
                    await projectDisplay.displayAllDocumentation(projectInfo);
                },
            }
        );

        logSuccess("\nProject listener is running!");
        logInfo("Publishing status updates every 60 seconds");
        logInfo("Press Ctrl+C to stop\n");

        // Handle shutdown
        process.on("SIGINT", () => {
            logInfo("\nShutting down project listener...");
            statusPublisher.stopPublishing();
            sub.stop();
            process.exit(0);
        });
    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to start project listener: ${errorMessage}`);
        process.exit(1);
    }
}
