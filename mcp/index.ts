import { loadAgentConfiguration } from "./agent-loader.js";
import { startMcpServer } from "./commands/mcp.js";
import { initConfig } from "./config.js";
import { initNDK } from "./ndk.js";

// Load config and start server
(async () => {
    try {
        let config = await initConfig();

        // Load agent configuration if AGENT_EVENT_ID is provided
        config = await loadAgentConfiguration(config);

        // Set the config instance for use throughout the application
        const { setConfigInstance } = await import("./config.js");
        setConfigInstance(config);

        // Initialize NDK with the loaded configuration
        await initNDK(config);

        // Directly run the MCP server
        startMcpServer();
    } catch (error) {
        // Use stderr for error output in MCP servers
        process.stderr.write(
            `Failed to initialize MCP server: ${error instanceof Error ? error.message : String(error)}\n`
        );
        process.exit(1);
    }
})();
