import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { logger } from "../utils/logger";

export async function handleProjectEvent(event: NDKEvent): Promise<void> {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
    logger.info(`📋 Project event update received: ${title}`);

    const agentEventIds = event.tags
        .filter((tag) => tag[0] === "agent" && tag[1])
        .map((tag) => tag[1]);

    if (agentEventIds.length > 0) {
        logger.info(`Project references ${agentEventIds.length} agent(s)`);
    }
}