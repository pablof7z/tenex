/**
 * Git-related type definitions
 */

/**
 * Type of git reset operation
 */
export type GitResetType = "soft" | "mixed" | "hard";

/**
 * Details about a git commit
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