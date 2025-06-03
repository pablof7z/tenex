import { startMcpServer } from "./commands/mcp.js";
import { initConfig } from "./config.js";
import { initNDK } from "./ndk.js";
import { Command } from "commander";

// Create the CLI program
const program = new Command();

program
    .name("tenex-mcp")
    .description("TENEX MCP Server")
    .version("0.3.4")
    .option("--nsec <nsec>", "Nostr private key (nsec format)")
    .parse(process.argv);

const options = program.opts();

// Load config with CLI options
const config = initConfig(options.nsec);

// Initialize NDK with the loaded configuration
// This assumes initNDK will handle the case where the key comes from env
initNDK(config);

// Directly run the MCP server
startMcpServer();
