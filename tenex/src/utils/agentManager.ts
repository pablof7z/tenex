import path from "node:path";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { getAgentSigner as getAgentSignerFromAgents, readAgentsJson } from "./agents";
import { getPrimaryAgentName } from "./agents/getPrimaryAgent";

export async function getAgentSigner(
    projectPath: string,
    agentSlug?: string
): Promise<{
    signer: NDKPrivateKeySigner;
    nsec: string;
    isNew: boolean;
    configFile?: string;
}> {
    // If no agent specified, use the primary agent
    let agentName = agentSlug;
    if (!agentName) {
        agentName = await getPrimaryAgentName(projectPath);
        logger.info(`No agent specified, using primary agent: ${agentName}`);
    }
    // Try to get existing agent
    const result = await getAgentSignerFromAgents(projectPath, agentName);

    // Get the nsec from agents.json
    const agents = await readAgentsJson(projectPath);
    const agentConfig = agents[agentName];

    if (!agentConfig) {
        throw new Error(`Agent "${agentName}" not found in agents.json`);
    }

    const nsec = typeof agentConfig === "string" ? agentConfig : agentConfig.nsec;
    const configFile = typeof agentConfig === "object" ? agentConfig.file : undefined;

    return {
        signer: result.signer,
        nsec,
        isNew: false, // Since we're reading from existing agents.json
        configFile,
    };
}

export async function ensurePrimaryAgent(projectPath: string): Promise<void> {
    // This will use the primary agent
    await getAgentSigner(projectPath);
}
