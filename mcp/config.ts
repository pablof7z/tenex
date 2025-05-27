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
const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.primal.net",
    "wss://nos.lol",
];

// Default DB path
const DEFAULT_DB_PATH = join(homedir(), ".tenex.db");

// Default Projects directory path (relative to project root)
const DEFAULT_PROJECTS_DIR = join(process.cwd(), "mcp", "projects");

/**
 * Initialize configuration by loading the private key from environment
 * and setting defaults for other values.
 * @returns The config data
 * @throws Error if NSEC environment variable is not set.
 */
export function initConfig(): ConfigData {
    const privateKey = process.env.NSEC;

    if (!privateKey) {
        log("ERROR: FATAL: NSEC environment variable is not set.");
        throw new Error("NSEC environment variable is not set.");
    }

    // Basic validation for nsec format (optional but recommended)
    if (!privateKey.startsWith("nsec")) {
        log(
            "WARN: NSEC environment variable does not look like a valid nsec key."
        );
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
