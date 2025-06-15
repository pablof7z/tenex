import path from "node:path";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { logger } from "@tenex/shared/logger";
import { getAgentSigner as getAgentSignerFromAgents, readAgentsJson } from "./agents";

export async function getAgentSigner(
    projectPath: string,
    agentSlug = "default"
): Promise<{
    signer: NDKPrivateKeySigner;
    nsec: string;
    isNew: boolean;
    configFile?: string;
}> {
    // Try to get existing agent
    const result = await getAgentSignerFromAgents(projectPath, agentSlug);

    // Get the nsec from agents.json
    const agents = await readAgentsJson(projectPath);
    const agentConfig = agents[agentSlug];

    if (!agentConfig) {
        throw new Error(`Agent "${agentSlug}" not found in agents.json`);
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

export async function ensureDefaultAgent(projectPath: string): Promise<void> {
    await getAgentSigner(projectPath, "default");
}
