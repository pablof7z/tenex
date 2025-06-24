import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Upload, Edit2, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { NDKEvent, NDKArticle } from "@nostr-dev-kit/ndk";
import { useNDK, useNDKCurrentUser, type NDKProject } from "@nostr-dev-kit/ndk-hooks";
import NDKBlossom from "@nostr-dev-kit/ndk-blossom";
import { useSpeechToText } from "../../hooks/useSpeechToText";
import { useLLM } from "../../hooks/useLLM";
import { toast } from "sonner";
import { Buffer } from "buffer";

// Polyfill Buffer for browser
if (typeof window !== 'undefined') {
    (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

interface VoiceRecorderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    project: NDKProject;
}

export function VoiceRecorderDialog({
    open,
    onOpenChange,
    project,
}: VoiceRecorderDialogProps) {
    const { ndk } = useNDK();
    const currentUser = useNDKCurrentUser();
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcription, setTranscription] = useState("");
    const [isEditingTranscription, setIsEditingTranscription] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    const { transcribe } = useSpeechToText();
    const { cleanupText } = useLLM();

    const updateDuration = useCallback(() => {
        if (isRecording && startTimeRef.current > 0) {
            const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setRecordingDuration(duration);
            console.log("Duration update:", duration);
            animationFrameRef.current = requestAnimationFrame(updateDuration);
        }
    }, [isRecording]);

    const drawWaveform = useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Use frequency data for bars visualization
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            if (!isRecording || !analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw frequency bars
            const barWidth = canvas.width / bufferLength * 2.5;
            const barCount = Math.floor(canvas.width / (barWidth + 2));
            const step = Math.floor(bufferLength / barCount);

            for (let i = 0; i < barCount; i++) {
                const barHeight = (dataArray[i * step] / 255) * canvas.height * 0.8;
                const x = i * (barWidth + 2);
                const y = (canvas.height - barHeight) / 2;

                // Create gradient for each bar
                const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
                gradient.addColorStop(0, 'rgba(239, 68, 68, 0.8)'); // red-500
                gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');

                // Draw rounded bars
                ctx.fillStyle = gradient;
                ctx.beginPath();
                
                // Use roundRect if available, otherwise fallback to regular rect
                if (ctx.roundRect) {
                    ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
                } else {
                    // Fallback for browsers without roundRect support
                    ctx.rect(x, y, barWidth, barHeight);
                }
                ctx.fill();
            }

            // Continue animation loop
            if (isRecording) {
                requestAnimationFrame(draw);
            }
        };

        draw();
    }, [isRecording]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
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

    // Start timer and waveform when recording begins
    useEffect(() => {
        if (isRecording && startTimeRef.current > 0) {
            updateDuration();
            drawWaveform();
        }
    }, [isRecording, updateDuration, drawWaveform]);

    // Auto-start recording when dialog opens
    useEffect(() => {
        if (open && !isRecording && !audioBlob) {
            const timer = setTimeout(() => {
                startRecording();
            }, 100); // Small delay to ensure dialog is fully rendered
            return () => clearTimeout(timer);
        }
    }, [open]);

    const startRecording = async () => {
        try {
            // Reset any previous state
            setAudioBlob(null);
            setAudioUrl(null);
            setRecordingDuration(0);
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Check if stream is active
            if (!stream.active) {
                throw new Error("Microphone stream is not active");
            }

            // Set up audio visualization
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            analyserRef.current.fftSize = 256;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                console.log("Data available:", event.data.size);
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstart = () => {
                console.log("Recording started");
                startTimeRef.current = Date.now();
                setIsRecording(true);
            };

            mediaRecorder.onstop = () => {
                console.log("Recording stopped, chunks:", chunksRef.current.length);
                const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setRecordingDuration(finalDuration);
                console.log("Final duration:", finalDuration);
                
                const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
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

            console.log("Starting recording...");
            mediaRecorder.start(1000); // Collect data every second
        } catch (error) {
            console.error("Error starting recording:", error);
            toast.error("Failed to start recording");
            setIsRecording(false);
        }
    };

    const handleTranscribeAndUpload = async () => {
        if (!audioBlob || !currentUser) return;

        setIsUploading(true);
        setIsTranscribing(true);

        try {
            // Start transcription
            const transcriptionPromise = transcribe(audioBlob);

            // Start upload
            const blossom = new NDKBlossom(ndk!);
            const audioFile = new File([audioBlob], `voice-recording-${Date.now()}.webm`, {
                type: audioBlob.type || "audio/webm",
            });
            const uploadPromise = blossom.upload(audioFile, {
                server: "https://blossom.primal.net"
            });

            // Wait for both operations
            const [transcriptionResult, uploadResult] = await Promise.all([
                transcriptionPromise,
                uploadPromise,
            ]);

            setTranscription(transcriptionResult || "");
            setIsTranscribing(false);
            setIsEditingTranscription(true);

            // Store the upload URL for later use
            if (uploadResult?.url) {
                (window as unknown as { __voiceUploadUrl: string }).__voiceUploadUrl = uploadResult.url;
            }
        } catch (error) {
            console.error("Error during transcription/upload:", error);
            toast.error("Failed to process recording");
            setIsUploading(false);
            setIsTranscribing(false);
        }
    };

    const handleSubmit = async () => {
        if (!transcription || !currentUser) return;

        try {
            // Clean up the text using LLM
            const cleanedText = await cleanupText(transcription);

            // Determine if we should create a thread or article
            const isLongRecording = recordingDuration > 600; // 10 minutes

            if (isLongRecording) {
                // Create NDKArticle
                const article = new NDKArticle(ndk!);
                article.title = cleanedText.split("\n")[0]?.substring(0, 100) || "Voice Recording";
                article.content = cleanedText;
                article.tags.push(["a", project.tagId()]);
                
                // Add audio attachment if available
                const voiceUrl = (window as unknown as { __voiceUploadUrl?: string }).__voiceUploadUrl;
                if (voiceUrl) {
                    article.tags.push(["audio", voiceUrl]);
                }

                await article.publish();
                toast.success("Article created successfully");
            } else {
                // Create kind:11 thread
                const thread = new NDKEvent(ndk!);
                thread.kind = 11;
                thread.content = cleanedText;
                thread.tags.push(["a", project.tagId()]);
                
                // Add audio attachment if available
                const voiceUrl = (window as unknown as { __voiceUploadUrl?: string }).__voiceUploadUrl;
                if (voiceUrl) {
                    thread.tags.push(["audio", voiceUrl]);
                }

                await thread.publish();
                toast.success("Thread created successfully");
            }

            // Clean up
            delete (window as unknown as { __voiceUploadUrl?: string }).__voiceUploadUrl;
            onOpenChange(false);
            resetState();
        } catch (error) {
            console.error("Error creating content:", error);
            toast.error("Failed to create content");
        }
    };

    const resetState = () => {
        // Stop any ongoing recording first
        stopRecording();
        
        // Clean up audio URL if it exists
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        
        // Reset all state
        setAudioBlob(null);
        setAudioUrl(null);
        setTranscription("");
        setIsEditingTranscription(false);
        setRecordingDuration(0);
        setIsUploading(false);
        setIsTranscribing(false);
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full max-w-lg p-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900">Voice Message</h2>
                        {isRecording && (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-sm font-medium text-red-500">Recording</span>
                            </div>
                        )}
                    </div>
                </div>

                {!audioBlob && (
                    <div className="px-6 py-8">
                        <div className="flex flex-col items-center space-y-8">
                            {/* Waveform Visualization */}
                            <div className="w-full max-w-md">
                                <canvas
                                    ref={canvasRef}
                                    width={400}
                                    height={120}
                                    className="w-full h-30 rounded-lg"
                                    style={{ maxWidth: '100%', height: 'auto' }}
                                />
                            </div>

                            {/* Timer Display */}
                            <div className="text-center">
                                <div className="text-5xl font-light tracking-tight text-gray-900 tabular-nums">
                                    {formatDuration(recordingDuration)}
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    {isRecording ? "Tap to stop recording" : "Initializing..."}
                                </p>
                            </div>

                            {/* Recording Control */}
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

                {audioBlob && !isEditingTranscription && (
                    <div className="px-6 py-8">
                        <div className="space-y-6">
                            {/* Audio Player */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <audio controls src={audioUrl!} className="w-full" />
                                <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                                    <span>Duration</span>
                                    <span className="font-medium">{formatDuration(recordingDuration)}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={resetState}
                                    className="flex-1 h-12 font-medium"
                                >
                                    Re-record
                                </Button>
                                <Button
                                    onClick={handleTranscribeAndUpload}
                                    disabled={isUploading}
                                    className="flex-1 h-12 font-medium"
                                >
                                    {isUploading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Processing
                                        </div>
                                    ) : (
                                        "Continue"
                                    )}
                                </Button>
                            </div>

                            {/* Status Messages */}
                            {isTranscribing && (
                                <div className="text-center">
                                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                        Transcribing audio...
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isEditingTranscription && (
                    <div className="flex flex-col h-full">
                        {/* Transcription Header */}
                        <div className="px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium text-gray-900">Review Transcription</h3>
                                <button
                                    onClick={() => setIsEditingTranscription(true)}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <Edit2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Transcription Content */}
                        <div className="flex-1 px-6 py-4">
                            <Textarea
                                value={transcription}
                                onChange={(e) => setTranscription(e.target.value)}
                                rows={12}
                                className="w-full h-full resize-none border-gray-200 focus:border-gray-400 focus:ring-0 rounded-lg"
                                placeholder="Transcription will appear here..."
                            />
                            <div className="mt-2 text-xs text-gray-500 text-right">
                                {transcription.split(' ').filter(word => word.length > 0).length} words
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 border-t border-gray-100">
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setIsEditingTranscription(false);
                                        setTranscription("");
                                    }}
                                    className="flex-1 h-12 font-medium"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!transcription.trim()}
                                    className="flex-1 h-12 font-medium"
                                >
                                    {recordingDuration > 600 ? "Create Article" : "Create Thread"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}