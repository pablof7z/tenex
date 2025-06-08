"use client";

import type { CommitDetails, GitOperationResult, GitResetOptions } from "@/types/git";
import { useCallback, useState } from "react";

/**
 * Custom hook for git operations using MCP tools
 * Provides clean interface for components to use git functionality
 */
export function useGitOperations() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Reset git repository to a specific commit
     */
    const resetToCommit = useCallback(
        async (commitHash: string, options: GitResetOptions = {}): Promise<GitOperationResult> => {
            setIsLoading(true);
            setError(null);

            try {
                // Call MCP tool for git reset
                const response = await fetch("/api/mcp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        server_name: "tenex",
                        tool_name: "git_reset_to_commit",
                        arguments: {
                            commitHash,
                            resetType: options.resetType || "mixed",
                            validateCommit: options.validateCommit !== false,
                        },
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.message || "Git reset failed");
                }

                return {
                    success: true,
                    message: result.message,
                    data: result.data,
                };
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
                setError(errorMessage);
                return {
                    success: false,
                    message: errorMessage,
                };
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    /**
     * Get detailed information about a commit
     */
    const getCommitDetails = useCallback(async (commitHash: string): Promise<CommitDetails | null> => {
        setIsLoading(true);
        setError(null);

        try {
            // Call MCP tool for commit details
            const response = await fetch("/api/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    server_name: "tenex",
                    tool_name: "git_commit_details",
                    arguments: {
                        commitHash,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || "Failed to get commit details");
            }

            return result.data as CommitDetails;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
            setError(errorMessage);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Validate if a commit exists in the repository
     */
    const validateCommit = useCallback(async (commitHash: string): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            // Call MCP tool for commit validation
            const response = await fetch("/api/mcp", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    server_name: "tenex",
                    tool_name: "git_validate_commit",
                    arguments: {
                        commitHash,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.success && result.data?.isValid === true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
            setError(errorMessage);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Clear any existing error state
     */
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isLoading,
        error,
        resetToCommit,
        getCommitDetails,
        validateCommit,
        clearError,
    };
}
