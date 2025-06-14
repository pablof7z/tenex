import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { CreateTaskDialog } from "./CreateTaskDialog";

interface VoiceTaskDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: NDKProject;
    onTaskCreated?: () => void;
}

interface ExtractedTaskData {
    title: string;
    description: string;
}

export function VoiceTaskDialog({
    open,
    onOpenChange,
    project,
    onTaskCreated,
}: VoiceTaskDialogProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
    const [extractedTaskData, setExtractedTaskData] = useState<ExtractedTaskData | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Auto-start recording when dialog opens
    useEffect(() => {
        if (open && !isRecording && !isTranscribing) {
            startRecording();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const startRecording = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("MediaDevices API not supported");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, {
                    type: "audio/wav",
                });
                stream.getTracks().forEach((track) => track.stop());
                transcribeAudio(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error starting recording:", error);
            let errorMessage = "Failed to start recording.";

            if (error instanceof DOMException) {
                switch (error.name) {
                    case "NotAllowedError":
                        errorMessage =
                            "Microphone access denied. Please allow microphone access and try again.";
                        break;
                    case "NotFoundError":
                        errorMessage =
                            "No microphone found. Please connect a microphone and try again.";
                        break;
                    case "NotSupportedError":
                        errorMessage = "Audio recording not supported on this device.";
                        break;
                    case "SecurityError":
                        errorMessage =
                            "Microphone access blocked by security policy. Please use HTTPS.";
                        break;
                    default:
                        errorMessage = `Recording error: ${error.message}`;
                }
            } else if (
                error instanceof Error &&
                error.message === "MediaDevices API not supported"
            ) {
                errorMessage = "Audio recording not supported on this browser.";
            }

            alert(errorMessage);
            onOpenChange(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const transcribeAudio = async (audioBlob: Blob) => {
        const openaiApiKey = localStorage.getItem("openaiApiKey");
        if (!openaiApiKey) {
            alert("Please set your OpenAI API key in settings first.");
            onOpenChange(false);
            return;
        }

        setIsTranscribing(true);
        try {
            // Step 1: Transcribe the audio
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.wav");
            formData.append("model", "whisper-1");

            const transcriptionResponse = await fetch(
                "https://api.openai.com/v1/audio/transcriptions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${openaiApiKey}`,
                    },
                    body: formData,
                }
            );

            if (!transcriptionResponse.ok) {
                throw new Error("Transcription failed");
            }

            const transcriptionData = await transcriptionResponse.json();
            const transcription = transcriptionData.text;

            // Step 2: Extract title and description using OpenAI
            const extractionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content:
                                'You are a helpful assistant that extracts task titles and descriptions from voice transcriptions. Return a JSON object with "title" and "description" fields. The title should be concise (max 100 characters) and the description should provide more detail.',
                        },
                        {
                            role: "user",
                            content: `Extract a task title and description from this transcription: "${transcription}"`,
                        },
                    ],
                    response_format: { type: "json_object" },
                }),
            });

            if (!extractionResponse.ok) {
                throw new Error("Task extraction failed");
            }

            const extractionData = await extractionResponse.json();
            const extracted = JSON.parse(
                extractionData.choices[0].message.content
            ) as ExtractedTaskData;

            setExtractedTaskData(extracted);
            onOpenChange(false);
            setShowCreateTaskDialog(true);
        } catch (error) {
            console.error("Processing error:", error);
            alert("Failed to process audio. Please try again.");
            onOpenChange(false);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleClose = () => {
        if (isRecording) {
            stopRecording();
        }
        onOpenChange(false);
    };

    const handleCreateTaskDialogClose = () => {
        setShowCreateTaskDialog(false);
        setExtractedTaskData(null);
    };

    const handleTaskCreated = () => {
        setShowCreateTaskDialog(false);
        setExtractedTaskData(null);
        onTaskCreated?.();
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Voice Task</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Recording Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-center">
                                <Button
                                    variant={isRecording ? "destructive" : "default"}
                                    size="lg"
                                    onClick={stopRecording}
                                    disabled={isTranscribing || !isRecording}
                                    className="w-20 h-20 rounded-full"
                                >
                                    {isRecording ? (
                                        <Square className="w-8 h-8" />
                                    ) : (
                                        <Mic className="w-8 h-8" />
                                    )}
                                </Button>
                            </div>

                            <p className="text-center text-sm text-muted-foreground">
                                {isTranscribing
                                    ? "Processing..."
                                    : isRecording
                                      ? "Recording... Tap to finish"
                                      : "Ready to record"}
                            </p>

                            {isTranscribing && (
                                <div className="flex justify-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={handleClose} disabled={isTranscribing}>
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Task Dialog */}
            {extractedTaskData && (
                <CreateTaskDialog
                    open={showCreateTaskDialog}
                    onOpenChange={handleCreateTaskDialogClose}
                    project={project}
                    onTaskCreated={handleTaskCreated}
                    initialTitle={extractedTaskData.title}
                    initialDescription={extractedTaskData.description}
                />
            )}
        </>
    );
}
