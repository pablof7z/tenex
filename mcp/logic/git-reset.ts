import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { GitResetType } from "../../types/git.js";
import { getCommitDetails, resetToCommit, validateCommitExists } from "../lib/git.js";
import { log } from "../lib/utils/log.js";

/**
 * Reset repository to a specific commit
 * @param commitHash The commit hash to reset to
 * @param resetType Type of reset: 'soft', 'mixed', or 'hard'
 * @returns Operation result
 */
export async function gitResetToCommit(
    commitHash: string,
    resetType: GitResetType = "mixed",
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
        log(`INFO: Starting git reset to commit ${commitHash} with type ${resetType}`);

        // Validate commit exists first
        const exists = await validateCommitExists(commitHash);
        if (!exists) {
            throw new Error(`Commit ${commitHash} does not exist in the repository`);
        }

        // Get commit details for logging
        const commitDetails = await getCommitDetails(commitHash);
        log(
            `INFO: Resetting to commit: ${commitDetails.shortHash} - "${commitDetails.message}" by ${commitDetails.author}`,
        );

        // Perform the reset
        await resetToCommit(commitHash, resetType);

        log(`INFO: Successfully reset repository to commit ${commitHash} using ${resetType} reset`);

        return {
            content: [
                {
                    type: "text",
                    text: `Successfully reset repository to commit ${commitDetails.shortHash} (${commitDetails.message}) using ${resetType} reset.`,
                },
            ],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`ERROR: Git reset failed: ${errorMessage}`);
        throw new Error(`Git reset failed: ${errorMessage}`);
    }
}

/**
 * Get detailed information about a commit
 * @param commitHash The commit hash to get details for
 * @returns Commit details
 */
export async function getGitCommitDetails(
    commitHash: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
        log(`INFO: Getting details for commit ${commitHash}`);

        // Validate commit exists first
        const exists = await validateCommitExists(commitHash);
        if (!exists) {
            throw new Error(`Commit ${commitHash} does not exist in the repository`);
        }

        // Get commit details
        const details = await getCommitDetails(commitHash);

        const detailsText = [
            `Commit Details:`,
            `Hash: ${details.hash}`,
            `Short Hash: ${details.shortHash}`,
            `Message: ${details.message}`,
            `Author: ${details.author}`,
            `Date: ${details.date}`,
        ].join("\n");

        log(`INFO: Retrieved commit details for ${commitHash}`);

        return {
            content: [
                {
                    type: "text",
                    text: detailsText,
                },
            ],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`ERROR: Failed to get commit details: ${errorMessage}`);
        throw new Error(`Failed to get commit details: ${errorMessage}`);
    }
}

/**
 * Validate if a commit exists in the repository
 * @param commitHash The commit hash to validate
 * @returns Validation result
 */
export async function validateGitCommit(
    commitHash: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
    try {
        log(`INFO: Validating commit ${commitHash}`);

        const exists = await validateCommitExists(commitHash);

        const resultText = exists
            ? `Commit ${commitHash} exists in the repository.`
            : `Commit ${commitHash} does not exist in the repository.`;

        log(`INFO: Commit validation result: ${exists}`);

        return {
            content: [
                {
                    type: "text",
                    text: resultText,
                },
            ],
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`ERROR: Commit validation failed: ${errorMessage}`);
        throw new Error(`Commit validation failed: ${errorMessage}`);
    }
}

/**
 * Register the git_reset_to_commit command with the MCP server
 * @param server The MCP server instance
 */
export function addGitResetToCommitCommand(server: McpServer) {
    server.tool(
        "git_reset_to_commit",
        "Reset the git repository to a specific commit",
        {
            commitHash: z.string().describe("The commit hash to reset to (can be full or short hash)"),
            resetType: z
                .enum(["soft", "mixed", "hard"])
                .optional()
                .default("mixed")
                .describe(
                    "Type of reset: 'soft' (keep changes staged), 'mixed' (unstage changes), or 'hard' (discard all changes)",
                ),
        },
        async ({ commitHash, resetType }: { commitHash: string; resetType?: GitResetType }, _extra: unknown) => {
            return await gitResetToCommit(commitHash, resetType || "mixed");
        },
    );
}

/**
 * Register the git_commit_details command with the MCP server
 * @param server The MCP server instance
 */
export function addGitCommitDetailsCommand(server: McpServer) {
    server.tool(
        "git_commit_details",
        "Get detailed information about a specific commit",
        {
            commitHash: z.string().describe("The commit hash to get details for (can be full or short hash)"),
        },
        async ({ commitHash }: { commitHash: string }, _extra: unknown) => {
            return await getGitCommitDetails(commitHash);
        },
    );
}

/**
 * Register the git_validate_commit command with the MCP server
 * @param server The MCP server instance
 */
export function addGitValidateCommitCommand(server: McpServer) {
    server.tool(
        "git_validate_commit",
        "Validate if a commit exists in the repository",
        {
            commitHash: z.string().describe("The commit hash to validate (can be full or short hash)"),
        },
        async ({ commitHash }: { commitHash: string }, _extra: unknown) => {
            return await validateGitCommit(commitHash);
        },
    );
}
