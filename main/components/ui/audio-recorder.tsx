"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertCircle, Mic, MicOff, Pause, Play, Square, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "recording" | "paused" | "stopped" | "processing" | "error";

interface AudioRecorderProps {
    onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
    onError?: (error: string) => void;
    maxDuration?: number; // in seconds, default 300 (5 minutes)
    className?: string;
    autoStart?: boolean; // Auto-start recording when component mounts
}

export function AudioRecorder({
    onRecordingComplete,
    onError,
    maxDuration = 300,
    className,
    autoStart = false,
}: AudioRecorderProps) {
    const [recordingState, setRecordingState] = useState<RecordingState>("idle");
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Check browser compatibility
    const isSupported =
        typeof window !== "undefined" &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window.MediaRecorder === "function";

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const handleError = useCallback(
        (errorMessage: string) => {
            setError(errorMessage);
            setRecordingState("error");
            onError?.(errorMessage);
        },
        [onError],
    );

    const startRecording = useCallback(async () => {
        if (!isSupported) {
            handleError("Audio recording is not supported in this browser");
            return;
        }

        try {
            clearError();
            setRecordingState("processing");

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000, // Optimal for Whisper
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            streamRef.current = stream;
            chunksRef.current = [];

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm;codecs=opus",
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
                setAudioBlob(blob);

                // Create URL for playback
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                setRecordingState("stopped");
                onRecordingComplete?.(blob, duration);
            };

            mediaRecorder.onerror = (event) => {
                handleError(`Recording error: ${event.error?.message || "Unknown error"}`);
            };

            mediaRecorder.start(1000); // Collect data every second
            setRecordingState("recording");
            setDuration(0);

            // Start duration timer
            intervalRef.current = setInterval(() => {
                setDuration((prev) => {
                    const newDuration = prev + 1;
                    if (newDuration >= maxDuration) {
                        stopRecording();
                        return maxDuration;
                    }
                    return newDuration;
                });
            }, 1000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to start recording";
            handleError(errorMessage);
        }
    }, [isSupported, maxDuration, duration, onRecordingComplete, handleError, clearError]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && recordingState === "recording") {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, [recordingState]);

    const cancelRecording = useCallback(() => {
        stopRecording();

        // Clean up
        setAudioBlob(null);
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setDuration(0);
        setPlaybackTime(0);
        setIsPlaying(false);
        setRecordingState("idle");
        chunksRef.current = [];
    }, [stopRecording, audioUrl]);

    const playPause = useCallback(() => {
        if (!audioRef.current || !audioUrl) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
                playbackIntervalRef.current = null;
            }
        } else {
            audioRef.current.play();
            setIsPlaying(true);

            // Update playback time
            playbackIntervalRef.current = setInterval(() => {
                if (audioRef.current) {
                    setPlaybackTime(audioRef.current.currentTime);
                }
            }, 100);
        }
    }, [isPlaying, audioUrl]);

    const resetPlayback = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            setPlaybackTime(0);
        }
    }, []);

    // Format time display
    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        const currentAudioUrl = audioUrl;
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (currentAudioUrl) {
                URL.revokeObjectURL(currentAudioUrl);
            }
        };
    }, [audioUrl]);

    // Handle audio element events
    useEffect(() => {
        if (audioRef.current && audioUrl) {
            const audio = audioRef.current;

            const handleEnded = () => {
                setIsPlaying(false);
                setPlaybackTime(0);
                if (playbackIntervalRef.current) {
                    clearInterval(playbackIntervalRef.current);
                    playbackIntervalRef.current = null;
                }
            };

            audio.addEventListener("ended", handleEnded);
            return () => audio.removeEventListener("ended", handleEnded);
        }
    }, [audioUrl]);

    // Cleanup on unmount
    useEffect(() => {
        const currentAudioUrl = audioUrl;
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
            if (currentAudioUrl) {
                URL.revokeObjectURL(currentAudioUrl);
            }
        };
    }, [audioUrl]);

    // Auto-start recording when autoStart is true
    useEffect(() => {
        if (autoStart && recordingState === "idle") {
            startRecording();
        }
    }, [autoStart, recordingState, startRecording]);

    if (!isSupported) {
        return (
            <div className={cn("p-4 border border-destructive rounded-lg bg-destructive/10", className)}>
                <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">Audio recording is not supported in this browser</span>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            {/* Error Display */}
            {error && (
                <div className="p-3 border border-destructive rounded-lg bg-destructive/10">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                </div>
            )}

            {/* Recording Controls */}
            <div className="flex items-center gap-2">
                {recordingState === "idle" && (
                    <Button
                        onClick={startRecording}
                        variant="default"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                    >
                        <Mic className="h-4 w-4" />
                        Start Recording
                    </Button>
                )}

                {recordingState === "recording" && (
                    <>
                        <Button onClick={stopRecording} variant="outline" size="sm">
                            <Square className="h-4 w-4" />
                            Stop
                        </Button>
                        <Button onClick={cancelRecording} variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                            Cancel
                        </Button>
                    </>
                )}

                {recordingState === "stopped" && (
                    <>
                        <Button onClick={playPause} variant="outline" size="sm">
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {isPlaying ? "Pause" : "Play"}
                        </Button>
                        <Button onClick={resetPlayback} variant="ghost" size="sm">
                            <Square className="h-4 w-4" />
                            Reset
                        </Button>
                        <Button onClick={cancelRecording} variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </Button>
                    </>
                )}

                {recordingState === "processing" && (
                    <Button disabled variant="outline" size="sm">
                        <Upload className="h-4 w-4 animate-spin" />
                        Processing...
                    </Button>
                )}
            </div>

            {/* Recording Status */}
            {recordingState === "recording" && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-red-600 rounded-full animate-pulse" />
                        <span className="text-sm font-medium">Recording: {formatTime(duration)}</span>
                        <span className="text-xs text-muted-foreground">/ {formatTime(maxDuration)}</span>
                    </div>
                    <Progress value={(duration / maxDuration) * 100} className="h-1" />
                </div>
            )}

            {/* Playback Status */}
            {recordingState === "stopped" && audioUrl && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">
                            {formatTime(playbackTime)} / {formatTime(duration)}
                        </span>
                    </div>
                    <Progress value={duration > 0 ? (playbackTime / duration) * 100 : 0} className="h-1" />
                </div>
            )}

            {/* Hidden audio element for playback */}
            {audioUrl && (
                <audio
                    ref={audioRef}
                    src={audioUrl}
                    preload="metadata"
                    style={{ display: "none" }}
                    aria-label="Audio playback"
                >
                    <track kind="captions" srcLang="en" label="Audio recording" />
                </audio>
            )}
        </div>
    );
}
