"use client";

import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { Loader2, Mic } from "lucide-react";
import { useState } from "react";
import { AudioRecorder } from "@/components/ui/audio-recorder";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { LoadedProject } from "@/hooks/useProjects";
import { useTranscription } from "@/hooks/useTranscription";
import { NDKTask } from "@/lib/nostr/events/task";
import { parseTranscription } from "@/lib/parse-transcription";
import { applyTextCorrections } from "@/lib/text-corrections";

interface CreateTaskDialogProps {
    project: LoadedProject;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTaskCreated?: () => void; // Optional callback after task creation
}

export function CreateTaskDialog({ project, open, onOpenChange, onTaskCreated }: CreateTaskDialogProps) {
    const { ndk } = useNDK();
    const [taskTitle, setTaskTitle] = useState("");
    const [taskContent, setTaskContent] = useState("");
    const [isPublishing, setIsPublishing] = useState(false);
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
    const [autoStartRecording, setAutoStartRecording] = useState(false);
    const { toast } = useToast();

    // Voice transcription functionality
    const {
        transcribe,
        isTranscribing,
        error: transcriptionError,
        clearError,
    } = useTranscription({
        onSuccess: (result) => {
            if (result.success && result.transcription) {
                // Apply text corrections
                const correctedText = applyTextCorrections(result.transcription);

                // Parse into title and description
                const parsed = parseTranscription(correctedText);

                if (parsed.title) {
                    setTaskTitle(parsed.title);
                }
                if (parsed.description) {
                    setTaskContent(parsed.description);
                }

                toast({
                    title: "Voice Transcription Complete",
                    description: "Your voice has been converted to text and populated in the form.",
                });

                setShowVoiceRecorder(false);
                setAutoStartRecording(false);
            }
        },
        onError: (error) => {
            toast({
                title: "Transcription Failed",
                description: error,
                variant: "destructive",
            });
        },
    });

    const handleVoiceRecording = async (audioBlob: Blob, duration: number) => {
        try {
            await transcribe(audioBlob);
        } catch (error) {
            // Error handling is done in the transcription hook
            console.error("Voice transcription failed:", error);
        }
    };

    const handleUseVoiceClick = () => {
        if (showVoiceRecorder) {
            // If already showing, hide it
            setShowVoiceRecorder(false);
            setAutoStartRecording(false);
        } else {
            // Show recorder and start recording immediately
            setShowVoiceRecorder(true);
            setAutoStartRecording(true);
        }
    };

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
            setShowVoiceRecorder(false); // Hide voice recorder
            setAutoStartRecording(false); // Reset auto-start flag
            clearError(); // Clear any transcription errors
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
                        <div className="flex items-center justify-between">
                            <Label htmlFor="task-content">Task Description</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleUseVoiceClick}
                                disabled={isPublishing || isTranscribing}
                                className="flex items-center gap-2"
                            >
                                <Mic className="h-4 w-4" />
                                {showVoiceRecorder ? "Hide Voice" : "Use Voice"}
                            </Button>
                        </div>
                        <Textarea
                            id="task-content"
                            placeholder="Enter task details here..."
                            value={taskContent}
                            onChange={(e) => setTaskContent(e.target.value)}
                            rows={5}
                            disabled={isPublishing}
                        />

                        {/* Voice Recording Section */}
                        {showVoiceRecorder && (
                            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Mic className="h-4 w-4" />
                                        <span className="text-sm font-medium">Voice Recording</span>
                                        {isTranscribing && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Transcribing...
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Recording started automatically. Speak your task description and it will be
                                        transcribed and parsed into title and description fields.
                                    </p>

                                    <AudioRecorder
                                        onRecordingComplete={handleVoiceRecording}
                                        onError={(error) => {
                                            toast({
                                                title: "Recording Error",
                                                description: error,
                                                variant: "destructive",
                                            });
                                        }}
                                        maxDuration={120} // 2 minutes max for task descriptions
                                        className="w-full"
                                        autoStart={autoStartRecording}
                                    />

                                    {transcriptionError && (
                                        <div className="text-sm text-destructive">{transcriptionError}</div>
                                    )}
                                </div>
                            </div>
                        )}
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
