"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmWorkModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialContent: string;
    onSubmit: (editedContent: string) => Promise<void>; // Make onSubmit async
    isSubmitting: boolean; // Add isSubmitting prop
}

export function ConfirmWorkModal({
    isOpen,
    onClose,
    initialContent,
    onSubmit,
    isSubmitting, // Use isSubmitting prop
}: ConfirmWorkModalProps) {
    const [editedContent, setEditedContent] = useState(initialContent);

    // Update internal state if initialContent changes while modal is open
    // (e.g., if replies load after button click but before modal interaction)
    useState(() => {
        setEditedContent(initialContent);
    });

    const handleSubmit = async () => {
        await onSubmit(editedContent);
        // onClose(); // Keep modal open until submission finishes or fails
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Confirm Agent Work Details</DialogTitle>
                    <DialogDescription>
                        Review and edit the combined task description and replies before starting the agent.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full gap-1.5">
                        <Label htmlFor="message">Combined Content</Label>
                        <Textarea
                            placeholder="Type your message here."
                            id="message"
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="h-64" // Make textarea larger
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Submitting..." : "Submit to Agent"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
