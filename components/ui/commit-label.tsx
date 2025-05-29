"use client";

import React, { useState } from 'react';
import { Copy, RotateCcw, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface CommitLabelProps {
  commitHash: string;
  showDropdown?: boolean;
  onReset?: (commitHash: string) => Promise<void>;
  onCopyHash?: (commitHash: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'text-xs px-1 py-0.5',
  md: 'text-xs px-1.5 py-0.5',
  lg: 'text-sm px-2 py-1',
};

export function CommitLabel({
  commitHash,
  showDropdown = false,
  onReset,
  onCopyHash,
  className,
  size = 'md',
}: CommitLabelProps) {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
    if (!onReset) return;
    
    setIsResetting(true);
    try {
      await onReset(commitHash);
      toast({
        title: "Reset successful",
        description: `Successfully reset to commit ${truncatedHash}`,
      });
    } catch (error) {
      toast({
        title: "Reset failed",
        description: `Failed to reset to commit ${truncatedHash}`,
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
      setShowResetDialog(false);
    }
  };

  const handleViewCommit = () => {
    // This would typically open the commit in a git viewer or external tool
    // For now, we'll just show a toast
    toast({
      title: "View commit",
      description: `Viewing commit ${truncatedHash}`,
    });
  };

  const commitLabel = (
    <span
      className={cn(
        "font-mono bg-muted rounded-md text-muted-foreground inline-block",
        sizeClasses[size],
        className
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
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
          >
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
              This action will reset your working directory to commit {truncatedHash}.
              Any uncommitted changes will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}