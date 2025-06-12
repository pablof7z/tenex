import chalk from "chalk";
import { getNDK } from "../../nostr/ndkClient";
import { getAgentSigner } from "../../utils/agentManager";
import { logError, logInfo, logSuccess } from "../../utils/logger";
import { EventHandler } from "./EventHandler";
import { ProjectDisplay } from "./ProjectDisplay";
import { ProjectLoader } from "./ProjectLoader";
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

		// Display project information
		const projectDisplay = new ProjectDisplay(ndk);
		await projectDisplay.displayProjectInfo(projectInfo);

		// Start the project listener
		await runProjectListener(projectInfo, ndk);
	} catch (err: any) {
		logError(`Failed to start project: ${err.message}`);
		process.exit(1);
	}
}

async function runProjectListener(projectInfo: any, ndk: any) {
	try {
		logInfo(
			`Starting listener for project: ${projectInfo.title} (${projectInfo.projectId})`,
		);

		// Set up agent signer
		const { signer } = await getAgentSigner(projectInfo.projectPath, "default");
		ndk.signer = signer;

		// Initialize event handler
		const eventHandler = new EventHandler(projectInfo, ndk);
		await eventHandler.initialize();

		// Start status publisher
		const statusPublisher = new StatusPublisher(ndk);
		await statusPublisher.startPublishing(projectInfo);

		// Set up event subscription
		const startupFilterTimestamp =
			Math.floor(Date.now() / 1000) - STARTUP_FILTER_MINUTES * 60;
		logInfo(
			`Filtering events from the last ${STARTUP_FILTER_MINUTES} minutes (since timestamp: ${startupFilterTimestamp})`,
		);

		// Create filters for both project-referencing events and the project event itself
		const projectRefFilter = projectInfo.projectEvent.filter();
		projectRefFilter.since = startupFilterTimestamp;

		const projectEventFilter = {
			kinds: [31933],
			authors: [projectInfo.projectPubkey],
			"#d": [projectInfo.projectId],
		};

		// Subscribe to both filters
		const sub = ndk.subscribe(
			[projectRefFilter, projectEventFilter],
			{ closeOnEose: false },
			{
				onEvent: async (event) => {
					await eventHandler.handleEvent(event);
				},
			},
		);

		console.log(
			chalk.cyan(
				"\n📡 Listening for project events...\n",
				JSON.stringify([projectRefFilter, projectEventFilter]),
			),
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
	} catch (err: any) {
		logError(`Failed to start project listener: ${err.message}`);
		process.exit(1);
	}
}
