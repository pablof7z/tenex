import path from "path";
import type { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import {
	type AgentSignerResult,
	getOrCreateAgentSigner as getSharedAgentSigner,
} from "@tenex/shared/agents";
import { logger } from "./logger";

export async function getAgentSigner(
	projectPath: string,
	agentSlug = "default",
): Promise<{
	signer: NDKPrivateKeySigner;
	nsec: string;
	isNew: boolean;
	configFile?: string;
}> {
	const result = await getSharedAgentSigner(projectPath, agentSlug);

	// Log if new agent was created
	if (result.isNew) {
		logger.info(`Created new agent '${agentSlug}'`);
	}

	// The shared function returns signer as 'any' to avoid import issues
	// Cast it back to NDKPrivateKeySigner since we know that's what it is
	return {
		signer: result.signer as NDKPrivateKeySigner,
		nsec: result.nsec,
		isNew: result.isNew,
		configFile: result.configFile,
	};
}

export async function ensureDefaultAgent(projectPath: string): Promise<void> {
	await getAgentSigner(projectPath, "default");
}
