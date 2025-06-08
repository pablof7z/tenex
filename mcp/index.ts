import { Command } from "commander";
import { startMcpServer } from "./commands/mcp.js";
import { initConfig } from "./config.js";
import { initNDK } from "./ndk.js";

// Create the CLI program
const program = new Command();

program
    .name("tenex-mcp")
    .description("TENEX MCP Server")
    .version("0.3.4")
    .option("--nsec <nsec>", "Nostr private key (nsec format) - DEPRECATED: use --config-file instead")
    .option("--config-file <path>", "Path to project .tenex/agents.json file")
    .parse(process.argv);

const options = program.opts();

// Load config with CLI options and start server
(async () => {
    try {
        const config = await initConfig(options.nsec, options.configFile);
        
        // Initialize NDK with the loaded configuration
        // This assumes initNDK will handle the case where the key comes from env
        await initNDK(config);
        
        // Directly run the MCP server
        startMcpServer();
    } catch (error) {
        console.error("Failed to initialize MCP server:", error);
        process.exit(1);
    }
})();
