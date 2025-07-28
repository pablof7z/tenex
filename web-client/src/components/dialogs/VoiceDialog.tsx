import { useState, useRef, useEffect, useCallback } from "react";
import { Square, Edit2, Check, X, RotateCcw, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import NDKBlossom from "@nostr-dev-kit/ndk-blossom";
import { useNDK } from "@nostr-dev-kit/ndk-hooks";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { useLLM } from "../../hooks/useLLM";
import { toast } from "sonner";

interface VoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: (data: {
        transcription: string;
        audioUrl: string;
        duration: number;
    }) => void;
    conversationId?: string;
    projectId?: string;
    replyToId?: string;
    mentionedAgents?: string[];
    publishAudioEvent?: boolean; // Whether to publish NIP-94 event
}

export function VoiceDialog({ 
    open, 
    onOpenChange, 
    onComplete,
    conversationId,
    projectId,
    replyToId,
    mentionedAgents,
    publishAudioEvent = false
}: VoiceDialogProps) {
    const { ndk } = useNDK();
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcription, setTranscription] = useState("");
    const [editedTranscription, setEditedTranscription] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
    const [waveformData, setWaveformData] = useState<number[]>([]);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { transcribe } = useSpeechToText();
    const { cleanupText } = useLLM();

    const updateDuration = useCallback(() => {
        if (isRecording && startTimeRef.current > 0) {
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setRecordingDuration(duration);
            animationFrameRef.current = requestAnimationFrame(updateDuration);
        }
    }, [isRecording]);

    const drawWaveform = useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const waveformCollector: number[] = [];

        const draw = () => {
            if (!isRecording || !analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            const barCount = Math.floor(canvas.width / (barWidth + 2));
            const step = Math.floor(bufferLength / barCount);

            // Collect waveform data (normalized amplitude values)
            let maxAmplitude = 0;
            for (let i = 0; i < barCount; i++) {
                const amplitude = (dataArray[i * step] || 0) / 255;
                maxAmplitude = Math.max(maxAmplitude, amplitude);
            }
            if (maxAmplitude > 0.1) {
                waveformCollector.push(maxAmplitude);
                // Keep only last MAX_WAVEFORM_SAMPLES for the waveform
                if (waveformCollector.length > 100) {
                    waveformCollector.shift();
                }
                setWaveformData([...waveformCollector]);
            }

            for (let i = 0; i < barCount; i++) {
                const barHeight = ((dataArray[i * step] || 0) / 255) * canvas.height * 0.8;
                const x = i * (barWidth + 2);
                const y = (canvas.height - barHeight) / 2;

                const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
                gradient.addColorStop(0, "rgba(239, 68, 68, 0.8)");
                gradient.addColorStop(1, "rgba(239, 68, 68, 0.3)");

                ctx.fillStyle = gradient;
                ctx.beginPath();

                if (ctx.roundRect) {
                    ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
                } else {
                    ctx.rect(x, y, barWidth, barHeight);
                }
                ctx.fill();
            }

            if (isRecording) {
                requestAnimationFrame(draw);
            }
        };

        draw();
    }, [isRecording]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = 0;
        }
    }, []);

    useEffect(() => {
        return () => {
            stopRecording();
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl, stopRecording]);

    useEffect(() => {
        if (isRecording && startTimeRef.current > 0) {
            updateDuration();
            drawWaveform();
        }
    }, [isRecording, updateDuration, drawWaveform]);

    useEffect(() => {
        if (open && !isRecording && !audioBlob) {
            const timer = setTimeout(() => {
                startRecording();
            }, 100);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [open, isRecording, audioBlob]);

    const startRecording = async () => {
        try {
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordingDuration(0);
            setTranscription("");
            setEditedTranscription("");
            setIsEditing(false);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            if (!stream.active) {
                throw new Error("Microphone stream is not active");
            }

            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstart = () => {
                startTimeRef.current = Date.now();
                setIsRecording(true);
            };

            mediaRecorder.onstop = () => {
                const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setRecordingDuration(finalDuration);

                const blob = new Blob(chunksRef.current, { 
                    type: mediaRecorder.mimeType || mimeType 
                });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                setIsRecording(false);
            };

            mediaRecorder.onerror = (event) => {
                console.error("MediaRecorder error:", event);
                toast.error("Recording error occurred");
                setIsRecording(false);
            };

            mediaRecorder.start(1000);
        } catch (error) {
            console.error("Error starting recording:", error);
            toast.error("Failed to start recording");
            setIsRecording(false);
        }
    };

    const handleProcess = async () => {
        if (!audioBlob) return;

        setIsProcessing(true);

        try {
            const transcriptionPromise = transcribe(audioBlob);

            const blossom = new NDKBlossom(ndk!);
            const audioFile = new File([audioBlob], `voice-recording-${Date.now()}.webm`, {
                type: audioBlob.type || "audio/webm",
            });
            const uploadPromise = blossom.upload(audioFile, {
                server: "https://blossom.primal.net",
                maxRetries: 3
            });

            const [rawTranscription, uploadResult] = await Promise.all([
                transcriptionPromise,
                uploadPromise,
            ]);

            if (rawTranscription) {
                const cleanedText = await cleanupText(rawTranscription);
                setTranscription(cleanedText);
                setEditedTranscription(cleanedText);
            }

            if (uploadResult?.url) {
                setUploadedAudioUrl(uploadResult.url);
            }

            setIsProcessing(false);
        } catch (error) {
            console.error("Error during processing:", error);
            toast.error("Failed to process recording");
            setIsProcessing(false);
        }
    };

    const handleSubmit = async () => {
        const finalTranscription = isEditing ? editedTranscription : transcription;
        
        if (finalTranscription.trim() && uploadedAudioUrl && audioBlob) {
            // Publish NIP-94 event if requested
            if (publishAudioEvent && ndk) {
                try {
                    // Create event manually
                    const event = new NDKEvent(ndk);
                    event.kind = 1063;
                    event.content = finalTranscription;
                    event.tags = [];
                    
                    // Add NIP-94 tags
                    event.tags.push(["url", uploadedAudioUrl]);
                    event.tags.push(["m", audioBlob.type || "audio/webm"]);
                    
                    // Calculate hash
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const hash = Array.from(new Uint8Array(arrayBuffer))
                        .slice(0, 32) // Just use first 32 bytes for simple hash
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                    event.tags.push(["x", hash.padEnd(64, '0')]);
                    event.tags.push(["size", String(audioBlob.size)]);
                    
                    // Add optional tags
                    if (recordingDuration > 0) {
                        event.tags.push(["duration", String(Math.floor(recordingDuration))]);
                    }
                    
                    if (waveformData.length > 0) {
                        const waveformString = waveformData.map(v => v.toFixed(2)).join(" ");
                        event.tags.push(["waveform", waveformString]);
                    }
                    
                    // Add conversation references
                    if (conversationId) {
                        if (replyToId) {
                            event.tags.push(["e", replyToId, "", "reply"]);
                            event.tags.push(["e", conversationId, "", "root"]);
                        } else {
                            event.tags.push(["e", conversationId]);
                        }
                    }
                    
                    if (projectId) {
                        event.tags.push(["a", projectId]);
                    }
                    
                    // Add agent mentions
                    if (mentionedAgents) {
                        for (const agentPubkey of mentionedAgents) {
                            event.tags.push(["p", agentPubkey]);
                        }
                    }
                    
                    await event.publish();
                    toast.success("Audio message published");
                } catch (error) {
                    console.error("Failed to publish audio event:", error);
                    toast.error("Failed to publish audio message");
                }
            }
            
            onComplete({
                transcription: finalTranscription,
                audioUrl: uploadedAudioUrl,
                duration: recordingDuration,
            });
            
            resetState();
            onOpenChange(false);
        }
    };

    const resetState = () => {
        stopRecording();
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioBlob(null);
        setAudioUrl(null);
        setTranscription("");
        setEditedTranscription("");
        setIsEditing(false);
        setRecordingDuration(0);
        setIsProcessing(false);
        setUploadedAudioUrl(null);
    };

    const startEditing = () => {
        setIsEditing(true);
        setTimeout(() => {
            textareaRef.current?.focus();
            textareaRef.current?.select();
        }, 50);
    };

    const cancelEditing = () => {
        setEditedTranscription(transcription);
        setIsEditing(false);
    };

    const confirmEdit = () => {
        setTranscription(editedTranscription);
        setIsEditing(false);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-lg p-0 overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium">Voice Message</h2>
                        {isRecording && (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-sm font-medium text-red-500">Recording</span>
                            </div>
                        )}
                    </div>
                </div>

                {!audioBlob && !transcription && (
                    <div className="px-6 py-8">
                        <div className="flex flex-col items-center space-y-8">
                            <div className="w-full max-w-md">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={120}
                                    className="w-full h-30 rounded-lg"
                                    style={{ maxWidth: "100%", height: "auto" }}
                                />
                            </div>

                            <div className="text-center">
                                <div className="text-5xl font-light tracking-tight tabular-nums">
                                    {formatDuration(recordingDuration)}
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {isRecording ? "Tap to stop recording" : "Initializing..."}
                                </p>
                            </div>

                            <button
                                onClick={stopRecording}
                                className="relative group"
                                disabled={!isRecording}
                            >
                                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center transition-all group-hover:scale-110 group-active:scale-95">
                                    <Square className="w-8 h-8 text-white fill-white" />
                                </div>
                                <div className="absolute inset-0 w-20 h-20 bg-red-500 rounded-full animate-ping opacity-25" />
                            </button>
                        </div>
                    </div>
                )}

                {audioBlob && !transcription && (
                    <div className="px-6 py-8">
                        <div className="space-y-6">
                            <div className="bg-muted rounded-xl p-4">
                                <audio controls src={audioUrl || ""} className="w-full" />
                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span>Duration</span>
                                    <span className="font-medium">
                                        {formatDuration(recordingDuration)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        resetState();
                                        startRecording();
                                    }}
                                    className="flex-1"
                                    disabled={isProcessing}
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Re-record
                                </Button>
                                <Button
                                    onClick={handleProcess}
                                    disabled={isProcessing}
                                    className="flex-1"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                                            Processing
                                        </>
                                    ) : (
                                        "Continue"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {transcription && (
                    <div className="flex flex-col h-full">
                        <div className="px-6 py-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium">Transcription</h3>
                                {!isEditing && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={startEditing}
                                        className="gap-1"
                                    >
                                        <Edit2 className="w-3 h-3" />
                                        Edit
                                    </Button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-2">
                                    <Textarea
                                        ref={textareaRef}
                                        value={editedTranscription}
                                        onChange={(e) => setEditedTranscription(e.target.value)}
                                        className="min-h-[200px] resize-none"
                                        placeholder="Edit your transcription..."
                                    />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">
                                            {editedTranscription.split(" ").filter(w => w.length > 0).length} words
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={cancelEditing}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={confirmEdit}
                                            >
                                                <Check className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="p-4 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors min-h-[200px]"
                                    onClick={startEditing}
                                >
                                    <p className="text-sm whitespace-pre-wrap">{transcription}</p>
                                    <p className="text-xs text-muted-foreground mt-4">
                                        Tap to edit • {transcription.split(" ").filter(w => w.length > 0).length} words
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
                            <Button 
                                variant="ghost" 
                                onClick={() => {
                                    resetState();
                                    onOpenChange(false);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSubmit}
                                disabled={isEditing || !transcription.trim()}
                            >
                                <Send className="w-4 h-4 mr-2" />
                                Send
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}