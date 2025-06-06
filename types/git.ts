/**
 * TypeScript type definitions for git operations and related interfaces
 */

/**
 * Git reset types supported by git reset command
 */
export type GitResetType = "soft" | "mixed" | "hard";

/**
 * Detailed information about a git commit
 */
export interface CommitDetails {
    /** Full commit hash */
    hash: string;
    /** Short commit hash (first 8 characters) */
    shortHash: string;
    /** Commit message */
    message: string;
    /** Author name and email */
    author: string;
    /** Commit date in ISO format */
    date: string;
}

/**
 * Result of a git operation
 */
export interface GitOperationResult {
    /** Whether the operation was successful */
    success: boolean;
    /** Optional message describing the result */
    message?: string;
    /** Optional data returned by the operation */
    data?: unknown;
}

/**
 * Git error types for better error handling
 */
export interface GitError extends Error {
    /** Git error code if available */
    code?: string;
    /** Git command that failed */
    command?: string;
}

/**
 * Options for git reset operation
 */
export interface GitResetOptions {
    /** Type of reset to perform */
    resetType?: GitResetType;
    /** Whether to validate commit exists before reset */
    validateCommit?: boolean;
}
