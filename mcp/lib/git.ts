import { type SimpleGit, simpleGit } from "simple-git";

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
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
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
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
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
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to get latest commit hash: ${errorMessage}`);
    }
}
