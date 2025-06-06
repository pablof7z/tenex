import { type SimpleGit, simpleGit } from "simple-git";
import type { CommitDetails, GitResetType } from "../../types/git.js";

/**
 * Git utility module for handling git operations
 * Uses the current working directory as the git repository
 */

let git: SimpleGit;

/**
 * Initialize the git instance
 */
function initGit(): SimpleGit {
    if (!git) {
        git = simpleGit();
    }
    return git;
}

/**
 * Check if there are uncommitted changes in the repository
 * @returns Promise<boolean> - true if there are uncommitted changes, false otherwise
 */
export async function hasUncommittedChanges(): Promise<boolean> {
    try {
        const gitInstance = initGit();

        // Check if we're in a git repository
        const isRepo = await gitInstance.checkIsRepo();
        if (!isRepo) {
            throw new Error("Not a git repository");
        }

        // Get status using --porcelain for machine-readable output
        const status = await gitInstance.status(["--porcelain"]);

        // If there are any files in the status, there are uncommitted changes
        return status.files.length > 0;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to check git status: ${errorMessage}`);
    }
}

/**
 * Create a commit with the given message
 * @param message - The commit message
 * @returns Promise<string | null> - The commit hash if successful, null if no changes to commit
 */
export async function createCommit(message: string): Promise<string | null> {
    try {
        const gitInstance = initGit();

        // Check if we're in a git repository
        const isRepo = await gitInstance.checkIsRepo();
        if (!isRepo) {
            throw new Error("Not a git repository");
        }

        // Check if there are any changes to commit
        const hasChanges = await hasUncommittedChanges();
        if (!hasChanges) {
            return null; // No changes to commit
        }

        // Add all changes
        await gitInstance.add(".");

        // Create the commit
        const result = await gitInstance.commit(message);

        // Return the short commit hash
        return result.commit.substring(0, 8);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to create commit: ${errorMessage}`);
    }
}

/**
 * Get the latest commit hash
 * @returns Promise<string | null> - The latest commit hash in short format, null if no commits exist
 */
export async function getLatestCommitHash(): Promise<string | null> {
    try {
        const gitInstance = initGit();

        // Check if we're in a git repository
        const isRepo = await gitInstance.checkIsRepo();
        if (!isRepo) {
            throw new Error("Not a git repository");
        }

        // Get the latest commit hash
        const log = await gitInstance.log({ maxCount: 1 });

        if (log.total === 0) {
            return null; // No commits exist
        }

        // Return the short commit hash (first 8 characters)
        return log.latest?.hash.substring(0, 8) || null;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to get latest commit hash: ${errorMessage}`);
    }
}

/**
 * Validate if a commit hash exists in the repository
 * @param commitHash - The commit hash to validate (can be full or short hash)
 * @returns Promise<boolean> - true if commit exists, false otherwise
 */
export async function validateCommitExists(commitHash: string): Promise<boolean> {
    try {
        const gitInstance = initGit();

        // Check if we're in a git repository
        const isRepo = await gitInstance.checkIsRepo();
        if (!isRepo) {
            throw new Error("Not a git repository");
        }

        // Validate commit hash format (basic check)
        if (!commitHash || commitHash.trim().length === 0) {
            return false;
        }

        // Try to get commit details - if it fails, commit doesn't exist
        try {
            await gitInstance.show([commitHash, "--format=%H", "--no-patch"]);
            return true;
        } catch {
            return false;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to validate commit: ${errorMessage}`);
    }
}

/**
 * Get detailed information about a specific commit
 * @param commitHash - The commit hash to get details for (can be full or short hash)
 * @returns Promise<CommitDetails> - Detailed commit information
 */
export async function getCommitDetails(commitHash: string): Promise<CommitDetails> {
    try {
        const gitInstance = initGit();

        // Check if we're in a git repository
        const isRepo = await gitInstance.checkIsRepo();
        if (!isRepo) {
            throw new Error("Not a git repository");
        }

        // Validate commit exists first
        const exists = await validateCommitExists(commitHash);
        if (!exists) {
            throw new Error(`Commit ${commitHash} does not exist`);
        }

        // Get commit details using git show with custom format
        const result = await gitInstance.show([commitHash, "--format=%H|%h|%s|%an <%ae>|%aI", "--no-patch"]);

        const lines = result.split("\n").filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
            throw new Error(`No commit details found for ${commitHash}`);
        }

        const firstLine = lines[0];
        if (!firstLine) {
            throw new Error(`No commit details found for ${commitHash}`);
        }

        const parts = firstLine.split("|");
        if (parts.length !== 5) {
            throw new Error(`Invalid commit format for ${commitHash}`);
        }

        const [hash, shortHash, message, author, date] = parts;

        if (!hash || !shortHash || !message || !author || !date) {
            throw new Error(`Incomplete commit details for ${commitHash}`);
        }

        return {
            hash: hash.trim(),
            shortHash: shortHash.trim(),
            message: message.trim(),
            author: author.trim(),
            date: date.trim(),
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to get commit details: ${errorMessage}`);
    }
}

/**
 * Reset the repository to a specific commit
 * @param commitHash - The commit hash to reset to (can be full or short hash)
 * @param resetType - Type of reset: 'soft', 'mixed', or 'hard' (default: 'mixed')
 * @returns Promise<void>
 */
export async function resetToCommit(commitHash: string, resetType: GitResetType = "mixed"): Promise<void> {
    try {
        const gitInstance = initGit();

        // Check if we're in a git repository
        const isRepo = await gitInstance.checkIsRepo();
        if (!isRepo) {
            throw new Error("Not a git repository");
        }

        // Validate commit exists
        const exists = await validateCommitExists(commitHash);
        if (!exists) {
            throw new Error(`Commit ${commitHash} does not exist`);
        }

        // Validate reset type
        const validResetTypes: GitResetType[] = ["soft", "mixed", "hard"];
        if (!validResetTypes.includes(resetType)) {
            throw new Error(`Invalid reset type: ${resetType}. Must be one of: ${validResetTypes.join(", ")}`);
        }

        // Perform the reset
        await gitInstance.reset([`--${resetType}`, commitHash]);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to reset to commit ${commitHash}: ${errorMessage}`);
    }
}
