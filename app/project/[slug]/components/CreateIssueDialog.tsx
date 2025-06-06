import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose, // Import DialogClose for the Cancel button
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label"; // Import Label
import { Textarea } from "@/components/ui/textarea";

interface CreateIssueDialogProps {
    isOpen: boolean;
    onClose: () => void;
    initialContent: string;
    onSubmit: (description: string) => void; // Function to handle issue creation logic
}

export function CreateIssueDialog({ isOpen, onClose, initialContent, onSubmit }: CreateIssueDialogProps) {
    const [description, setDescription] = useState(initialContent);

    // Update description when initialContent changes (e.g., clicking on a different tweet)
    useEffect(() => {
        setDescription(initialContent);
    }, [initialContent]);

    const handleSubmit = () => {
        // Add validation if needed
        if (description.trim()) {
            onSubmit(description);
            onClose(); // Close the dialog after submission
        }
    };

    // Handle changes to the open state correctly
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Issue</DialogTitle>
                    <DialogDescription>
                        Create a new issue based on this tweet. You can edit the description below.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full gap-1.5">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Type the issue description here."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="min-h-[150px]" // Adjust height as needed
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSubmit} disabled={!description.trim()}>
                        Create Issue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
