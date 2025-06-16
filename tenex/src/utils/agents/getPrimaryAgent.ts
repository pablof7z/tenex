import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@tenex/shared/logger";
import type { LegacyAgentsJson } from "@tenex/types/agents";

/**
 * Get the primary agent name from the agents configuration
 * The primary agent is determined by:
 * 1. If there's an agent named "orchestrator", use that
 * 2. Otherwise, use the first agent in the configuration
 * 3. If the configuration is empty, throw an error
 */
export async function getPrimaryAgentName(projectPath: string): Promise<string> {
    const agentsJsonPath = path.join(projectPath, ".tenex", "agents.json");

    try {
        const content = await readFile(agentsJsonPath, "utf-8");
        const agents: LegacyAgentsJson = JSON.parse(content);

        const agentNames = Object.keys(agents);

        if (agentNames.length === 0) {
            throw new Error("No agents found in agents.json");
        }

        // Check if there's an orchestrator agent
        if (agentNames.includes("orchestrator")) {
            logger.debug("Using 'orchestrator' as primary agent");
            return "orchestrator";
        }

        // Use the first agent as primary
        const primaryAgent = agentNames[0];
        logger.debug(`Using '${primaryAgent}' as primary agent`);
        return primaryAgent;
    } catch (error) {
        logger.error("Failed to read agents configuration", { error });
        throw new Error(`Failed to determine primary agent: ${error}`);
    }
}
