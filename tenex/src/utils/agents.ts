import { readFile } from "node:fs/promises";
import path from "node:path";
import { logError } from "@tenex/shared";
import type { AgentsJson } from "@tenex/types/agents";
import { getErrorMessage } from "@tenex/types/utils";

/**
 * Convert agent name to kebab-case for use as key in agents.json
 * Examples: "Christ" -> "christ", "Hello World" -> "hello-world"
 */
export function toKebabCase(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Read agents.json file from a project
 */
export async function readAgentsJson(projectPath: string): Promise<AgentsJson> {
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");
    try {
        const content = await readFile(agentsPath, "utf-8");
        return JSON.parse(content) as AgentsJson;
    } catch (error: unknown) {
        logError(`Failed to read agents.json: ${getErrorMessage(error)}`);
        throw error;
    }
}
