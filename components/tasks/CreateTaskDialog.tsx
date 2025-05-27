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
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input"; // Added Input
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { NDKProject } from "@/lib/nostr/events/project";
import { NDKTask } from "@/lib/nostr/events/task"; // Assuming this exists
import { Loader2 } from "lucide-react";
import { LoadedProject } from "@/hooks/useProjects";
import { useNDK } from "@nostr-dev-kit/ndk-hooks";

interface CreateTaskDialogProps {
    project: LoadedProject;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTaskCreated?: () => void; // Optional callback after task creation
}

export function CreateTaskDialog({ project, open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
    const { ndk } = useNDK();
    const [taskTitle, setTaskTitle] = useState(""); // Added title state
    const [taskContent, setTaskContent] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const { toast } = useToast();

    const handlePublish = async () => {
        if (!taskTitle.trim()) {
            toast({
                title: "Error",
                description: "Task title cannot be empty.",
                variant: "destructive",
            });
            return;
        }
        if (!taskContent.trim()) {
            toast({
                title: "Error",
                description: "Task description cannot be empty.",
                variant: "destructive",
            });
            return;
        }

        setIsPublishing(true);
        try {
            if (!ndk) throw new Error("NDK instance is not available on the project.");

            console.log("Creating NDKTask with title:", taskTitle, "and content:", taskContent);
            const task = new NDKTask(ndk);
            task.title = taskTitle.trim(); // Set the title
            task.content = taskContent.trim();
            if (project.event) task.project = project.event; // Use the setter to add the 'a' tag

            console.log("Getting project signer...");
            const projectSigner = await project.signer;
            task.pubkey = projectSigner.pubkey; // Task is published by the project key
            console.log("Task pubkey set to:", task.pubkey);

            console.log("Signing task event...");
            await task.sign(projectSigner);
            console.log("Publishing task event...");
            await task.publish();
            console.log("Task event published successfully.");

            toast({
                title: "Task Published",
                description: `Task "${task.title}" created.`, // Updated description
            });

            setTaskTitle(""); // Clear title input
            setTaskContent(""); // Clear textarea
            onOpenChange(false); // Close dialog
            onTaskCreated?.(); // Call callback if provided
        } catch (error: unknown) {
            console.error("Failed to publish task:", error);
            toast({
                title: "Error Publishing Task",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
                variant: "destructive",
            });
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[825px]">
                <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle> {/* Reverted title */}
                    <DialogDescription>
                        Provide a title and description for the new task. Click publish when you're done.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid w-full gap-1.5">
                        <Label htmlFor="task-title">Task Title</Label>
                        <Input
                            id="task-title"
                            placeholder="Enter task title..."
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            disabled={isPublishing}
                        />
                    </div>
                    <div className="grid w-full gap-1.5">
                        <Label htmlFor="task-content">Task Description</Label>
                        <Textarea
                            id="task-content"
                            placeholder="Enter task details here..."
                            value={taskContent}
                            onChange={(e) => setTaskContent(e.target.value)}
                            rows={5}
                            disabled={isPublishing}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
                        Cancel
                    </Button>
                    <Button onClick={handlePublish} disabled={isPublishing || !taskTitle.trim() || !taskContent.trim()}>
                        {" "}
                        {/* Updated disabled check */}
                        {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {isPublishing ? "Publishing..." : "Publish Task"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}