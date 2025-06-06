import { homedir } from "node:os";
import { join } from "node:path";
import { log } from "./lib/utils/log.js"; // Assuming log utility exists

// Simplified config structure
export interface ConfigData {
    privateKey: string; // Loaded from ENV
    dbPath: string;
    projectsDir: string; // Added projects directory path
    relays: string[];
}

// Default relays - adjust as needed
const DEFAULT_RELAYS = ["wss://relay.nostr.band", "wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol"];

// Default DB path
const DEFAULT_DB_PATH = join(homedir(), ".tenex.db");

// Default Projects directory path (relative to project root)
const DEFAULT_PROJECTS_DIR = join(process.cwd(), "mcp", "projects");

/**
 * Initialize configuration by loading the private key from CLI parameter or environment
 * and setting defaults for other values.
 * @param nsecFromCli - Optional nsec key from command line parameter
 * @returns The config data
 * @throws Error if neither CLI parameter nor NSEC environment variable is set.
 */
export function initConfig(nsecFromCli?: string): ConfigData {
    // Prefer CLI parameter over environment variable
    const privateKey = nsecFromCli || process.env.NSEC;

    if (!privateKey) {
        log("ERROR: FATAL: NSEC not provided via --nsec parameter or NSEC environment variable.");
        throw new Error("NSEC not provided via --nsec parameter or NSEC environment variable.");
    }

    // Basic validation for nsec format (optional but recommended)
    if (!privateKey.startsWith("nsec")) {
        log("WARN: NSEC does not look like a valid nsec key.");
        // Decide if you want to throw an error here or just warn
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
    };
}

// Added a simple getConfig function to reuse the initialized config
let configInstance: ConfigData | null = null;

export function getConfig(): ConfigData {
    if (!configInstance) {
        configInstance = initConfig();
    }
    return configInstance;
}
