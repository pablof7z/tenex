import { homedir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { log } from "./lib/utils/log.js"; // Assuming log utility exists

// Agent configuration - supports both old and new formats
export interface AgentConfig {
    [agentName: string]: string | {
        nsec: string;
        name: string;
        model?: string;
        mcpServers?: string[];
    };
}

// Simplified config structure
export interface ConfigData {
    privateKey?: string; // Optional - only needed for legacy single-signer mode
    dbPath: string;
    projectsDir: string; // Added projects directory path
    relays: string[];
    agentsConfigPath?: string; // Path to agents.json
    agents?: AgentConfig; // Agent configurations
    currentAgent?: string; // Current agent being used
}

// Default relays - adjust as needed
const DEFAULT_RELAYS = ["wss://relay.nostr.band", "wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol"];

// Default DB path
const DEFAULT_DB_PATH = join(homedir(), ".tenex.db");

// Default Projects directory path (relative to project root)
const DEFAULT_PROJECTS_DIR = join(process.cwd(), "mcp", "projects");

/**
 * Initialize configuration by loading the private key from CLI parameter, config file, or environment
 * and setting defaults for other values.
 * @param nsecFromCli - Optional nsec key from command line parameter (deprecated)
 * @param configFilePath - Optional path to agents.json file
 * @returns The config data
 * @throws Error if no valid configuration is found.
 */
export async function initConfig(nsecFromCli?: string, configFilePath?: string): Promise<ConfigData> {
    let privateKey: string | undefined;
    let agents: AgentConfig | undefined;
    let currentAgent: string | undefined;

    // If config file is provided, load agents configuration
    if (configFilePath) {
        try {
            const configContent = await fs.readFile(configFilePath, 'utf-8');
            agents = JSON.parse(configContent) as AgentConfig;
            log(`INFO: Loaded agents configuration from ${configFilePath}`);
            
            // Use 'default' agent if available
            if (agents.default) {
                privateKey = agents.default;
                currentAgent = 'default';
                log("INFO: Using 'default' agent from agents.json");
            } else {
                // Use the first available agent
                const agentNames = Object.keys(agents);
                if (agentNames.length > 0) {
                    currentAgent = agentNames[0];
                    privateKey = agents[currentAgent];
                    log(`INFO: Using '${currentAgent}' agent from agents.json`);
                }
            }
        } catch (err) {
            log(`ERROR: Failed to load agents config from ${configFilePath}: ${err}`);
            // Fall through to other methods
        }
    }

    // Fall back to CLI parameter or environment variable if no agents config
    if (!agents) {
        privateKey = nsecFromCli || process.env.NSEC;
        if (nsecFromCli) {
            log("WARN: Using deprecated --nsec parameter. Please use --config-file instead.");
        }
        
        if (!privateKey) {
            log("ERROR: FATAL: No valid configuration found. Provide --config-file, --nsec parameter, or NSEC environment variable.");
            throw new Error("No valid configuration found. Provide --config-file, --nsec parameter, or NSEC environment variable.");
        }
        
        // Basic validation for nsec format
        if (!privateKey.startsWith("nsec")) {
            log("WARN: Private key does not look like a valid nsec key.");
        }
    }

    log("INFO: Configuration initialized.");
    log(`INFO: Using DB path: ${DEFAULT_DB_PATH}`);
    log(`INFO: Using Projects path: ${DEFAULT_PROJECTS_DIR}`);
    log(`INFO: Using default relays: ${DEFAULT_RELAYS.join(", ")}`);

    return {
        privateKey,
        dbPath: DEFAULT_DB_PATH,
        projectsDir: DEFAULT_PROJECTS_DIR,
        relays: DEFAULT_RELAYS,
        agentsConfigPath: configFilePath,
        agents,
        currentAgent,
    };
}

// Added a simple getConfig function to reuse the initialized config
let configInstance: ConfigData | null = null;

export async function getConfig(): Promise<ConfigData> {
    if (!configInstance) {
        throw new Error("Config not initialized. Call initConfig() first.");
    }
    return configInstance;
}

export function setConfigInstance(config: ConfigData): void {
    configInstance = config;
}
