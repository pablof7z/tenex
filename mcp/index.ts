import { startMcpServer } from "./commands/mcp.js";
import { initConfig } from "./config.js";
import { initNDK } from "./ndk.js";

// Load config and start server
(async () => {
	try {
		const config = await initConfig();

		// Set the config instance for use throughout the application
		const { setConfigInstance } = await import("./config.js");
		setConfigInstance(config);

		// Initialize NDK with the loaded configuration
		await initNDK(config);

		// Directly run the MCP server
		startMcpServer();
	} catch (error) {
		console.error("Failed to initialize MCP server:", error);
		process.exit(1);
	}
})();
