import type { NDKEvent } from "@nostr-dev-kit/ndk";
import chalk from "chalk";
import { logger } from "../utils/logger";

const logInfo = logger.info.bind(logger);

export const handleTask = async (event: NDKEvent): Promise<void> => {
    const title = event.tags.find((tag) => tag[0] === "title")?.[1] || "Untitled";
    logInfo(chalk.gray("Task:    ") + chalk.yellow(title));
    logInfo(
        chalk.gray("Content: ") +
            chalk.white(event.content.substring(0, 100) + (event.content.length > 100 ? "..." : ""))
    );

    // Extract p-tags to identify mentioned agents
    const pTags = event.tags.filter((tag) => tag[0] === "p");
    const mentionedPubkeys = pTags.map((tag) => tag[1]);

    if (mentionedPubkeys.length > 0) {
        logInfo(
            chalk.gray("P-tags:  ") + chalk.cyan(`${mentionedPubkeys.length} pubkeys mentioned`)
        );
    }

    logInfo(chalk.yellow("Chat message handling not yet implemented"));
};
