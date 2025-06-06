"use client";

import { Copy, ExternalLink, RotateCcw } from "lucide-react";
import React, { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CommitDetailsModal } from "@/components/ui/commit-details-modal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { useGitOperations } from "@/hooks/useGitOperations";
import { cn } from "@/lib/utils";
import { CommitDetails } from "@/types/git";

interface CommitLabelProps {
    commitHash: string;
    showDropdown?: boolean;
    onReset?: (commitHash: string) => Promise<void>;
    onCopyHash?: (commitHash: string) => void;
    className?: string;
    size?: "sm" | "md" | "lg";
}

const sizeClasses = {
    sm: "text-xs px-1 py-0.5",
    md: "text-xs px-1.5 py-0.5",
    lg: "text-sm px-2 py-1",
};

export function CommitLabel({
    commitHash,
    showDropdown = false,
    onReset,
    onCopyHash,
    className,
    size = "md",
}: CommitLabelProps) {
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [showCommitDetails, setShowCommitDetails] = useState(false);
    const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);

    const { isLoading, error, resetToCommit, getCommitDetails, clearError } = useGitOperations();

    const truncatedHash = commitHash.substring(0, 7);

    const handleCopyHash = () => {
        navigator.clipboard.writeText(commitHash);
        toast({
            title: "Copied to clipboard",
            description: `Commit hash ${truncatedHash} copied to clipboard`,
        });
        onCopyHash?.(commitHash);
    };

    const handleReset = async () => {
        clearError();

        try {
            let result: { success: boolean; message?: string };
            if (onReset) {
                // Use custom onReset if provided
                await onReset(commitHash);
                result = { success: true };
            } else {
                // Use MCP git operations
                result = await resetToCommit(commitHash, { resetType: "mixed" });
            }

            if (result.success) {
                toast({
                    title: "Reset successful",
                    description: `Successfully reset to commit ${truncatedHash}`,
                });
                setShowResetDialog(false);
            } else {
                throw new Error(result.message || "Reset failed");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
            toast({
                title: "Reset failed",
                description: errorMessage,
                variant: "destructive",
            });
        }
    };

    const handleViewCommit = async () => {
        clearError();

        try {
            const details = await getCommitDetails(commitHash);
            if (details) {
                setCommitDetails(details);
                setShowCommitDetails(true);
            } else {
                toast({
                    title: "Failed to load commit details",
                    description: error || "Could not retrieve commit information",
                    variant: "destructive",
                });
            }
        } catch (err) {
            toast({
                title: "Error loading commit details",
                description: "Failed to fetch commit information",
                variant: "destructive",
            });
        }
    };

    const commitLabel = (
        <span
            className={cn(
                "font-mono bg-muted rounded-md text-muted-foreground inline-block",
                sizeClasses[size],
                className,
            )}
            title={`Commit: ${commitHash}`}
        >
            {truncatedHash}
        </span>
    );

    if (!showDropdown) {
        return commitLabel;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                        {commitLabel}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={handleCopyHash}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy commit hash
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleViewCommit}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View commit details
                    </DropdownMenuItem>
                    {onReset && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setShowResetDialog(true)}
                                className="text-destructive focus:text-destructive"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset to this commit
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset to commit {truncatedHash}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action will reset your working directory to commit {truncatedHash}. Any uncommitted
                            changes will be lost. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleReset}
                            disabled={isLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isLoading ? "Resetting..." : "Reset"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <CommitDetailsModal
                isOpen={showCommitDetails}
                onOpenChange={setShowCommitDetails}
                commitDetails={commitDetails}
                onReset={
                    onReset ||
                    (async (hash) => {
                        const result = await resetToCommit(hash, { resetType: "mixed" });
                        if (!result.success) {
                            throw new Error(result.message || "Reset failed");
                        }
                    })
                }
                isResetting={isLoading}
            />
        </>
    );
}
