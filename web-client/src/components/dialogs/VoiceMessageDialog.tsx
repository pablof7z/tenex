import type { NDKProject } from "@nostr-dev-kit/ndk-hooks";
import { NDKEvent, useNDK } from "@nostr-dev-kit/ndk-hooks";
import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLLMConfig } from "../../hooks/useLLMConfig";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface VoiceMessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: NDKProject;
    onMessageSent?: () => void;
}

export function VoiceMessageDialog({
    open,
    onOpenChange,
    project,
    onMessageSent,
}: VoiceMessageDialogProps) {
    const { ndk } = useNDK();
    const { getSpeechConfig } = useLLMConfig();
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Auto-start recording when dialog opens
    useEffect(() => {
        if (open && !isRecording && !isTranscribing) {
            startRecording();
        }
    }, [open, isRecording, isTranscribing]);

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
                for (const track of stream.getTracks()) {
                    track.stop();
                }
                transcribeAudio(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
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
        const speechConfig = getSpeechConfig();
        if (!speechConfig) {
            alert("Please configure speech-to-text in settings first.");
            onOpenChange(false);
            return;
        }

        setIsTranscribing(true);
        try {
            // Transcribe the audio using configured speech provider
            const formData = new FormData();
            formData.append("file", audioBlob, "audio.wav");
            formData.append("model", speechConfig.config.model);
            
            if (speechConfig.config.language) {
                formData.append("language", speechConfig.config.language);
            }

            const baseURL = speechConfig.credentials.baseUrl || 
                           (speechConfig.config.provider === 'openai' 
                               ? "https://api.openai.com/v1"
                               : "https://openrouter.ai/api/v1");

            const headers: Record<string, string> = {
                Authorization: `Bearer ${speechConfig.credentials.apiKey}`,
            };

            // Add OpenRouter-specific headers
            if (speechConfig.config.provider === 'openrouter') {
                headers["HTTP-Referer"] = window.location.origin;
                headers["X-Title"] = "TENEX Web Client";
            }

            const transcriptionResponse = await fetch(
                `${baseURL}/audio/transcriptions`,
                {
                    method: "POST",
                    headers,
                    body: formData,
                }
            );

            if (!transcriptionResponse.ok) {
                throw new Error("Transcription failed");
            }

            const transcriptionData = await transcriptionResponse.json();
            const transcription = transcriptionData.text;

            // Send as a regular message to the project
            if (ndk) {
                const event = new NDKEvent(ndk);
                event.kind = 1;
                event.content = `🎤 Voice message: ${transcription}`;
                event.tags = [
                    ["a", project.tagId()],
                ];
                
                event.publish();
                onMessageSent?.();
            }

            onOpenChange(false);
        } catch (_error) {
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Voice Message</DialogTitle>
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
    );
}