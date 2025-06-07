"use client";

import { Calendar, Copy, Hash, RotateCcw, User } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { CommitDetails } from "@/types/git";

interface CommitDetailsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    commitDetails: CommitDetails | null;
    onReset?: (commitHash: string) => Promise<void>;
    isResetting?: boolean;
}

export function CommitDetailsModal({
    isOpen,
    onOpenChange,
    commitDetails,
    onReset,
    isResetting = false,
}: CommitDetailsModalProps) {
    if (!commitDetails) {
        return null;
    }

    const handleCopyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        toast({
            title: "Copied to clipboard",
            description: `Commit hash ${hash.substring(0, 7)} copied to clipboard`,
        });
    };

    const handleReset = async () => {
        if (!onReset) return;

        try {
            await onReset(commitDetails.hash);
            onOpenChange(false);
        } catch (error) {
            // Error handling is done in the parent component
        }
    };

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleString();
        } catch {
            return dateString;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Hash className="h-5 w-5" />
                        Commit Details
                    </DialogTitle>
                    <DialogDescription>Detailed information about commit {commitDetails.shortHash}</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Commit Hash Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-muted-foreground">Commit Hash</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyHash(commitDetails.hash)}
                                className="h-auto p-1"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-xs">
                                {commitDetails.shortHash}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">{commitDetails.hash}</span>
                        </div>
                    </div>

                    <Separator />

                    {/* Commit Message Section */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">Message</h3>
                        <div className="bg-muted/50 rounded-md p-3">
                            <p className="text-sm whitespace-pre-wrap">{commitDetails.message}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* Author and Date Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-medium text-muted-foreground">Author</h3>
                            </div>
                            <p className="text-sm">{commitDetails.author}</p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <h3 className="text-sm font-medium text-muted-foreground">Date</h3>
                            </div>
                            <p className="text-sm">{formatDate(commitDetails.date)}</p>
                        </div>
                    </div>

                    {/* Actions Section */}
                    {onReset && (
                        <>
                            <Separator />
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Actions</h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleCopyHash(commitDetails.hash)}
                                    >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy Hash
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleReset}
                                        disabled={isResetting}
                                    >
                                        <RotateCcw className={cn("mr-2 h-4 w-4", isResetting && "animate-spin")} />
                                        {isResetting ? "Resetting..." : "Reset to this commit"}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
