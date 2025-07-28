import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download } from "lucide-react";
import { Button } from "../ui/button";
import { NDKEvent } from "@nostr-dev-kit/ndk";
import { getAudioURL, getAudioDuration, getAudioWaveform } from "../../utils/audioEvents";
import { cn } from "../../lib/utils";

interface VoiceMessageProps {
    event: NDKEvent;
    isFromCurrentUser?: boolean;
}

export function VoiceMessage({ event, isFromCurrentUser = false }: VoiceMessageProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    const audioUrl = getAudioURL(event);
    const eventDuration = getAudioDuration(event);
    const waveform = getAudioWaveform(event);

    useEffect(() => {
        if (eventDuration > 0) {
            setDuration(eventDuration);
        }
    }, [eventDuration]);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    const togglePlayback = async () => {
        if (!audioUrl) return;

        if (!audioRef.current) {
            audioRef.current = new Audio(audioUrl);
            
            audioRef.current.addEventListener("loadedmetadata", () => {
                if (audioRef.current && eventDuration === 0) {
                    setDuration(audioRef.current.duration);
                }
            });

            audioRef.current.addEventListener("timeupdate", () => {
                if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                }
            });

            audioRef.current.addEventListener("ended", () => {
                setIsPlaying(false);
                setCurrentTime(0);
            });

            audioRef.current.addEventListener("error", (e) => {
                console.error("Audio playback error:", e);
                setIsLoading(false);
                setIsPlaying(false);
            });
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            setIsLoading(true);
            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (error) {
                console.error("Failed to play audio:", error);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    const renderWaveform = () => {
        if (waveform.length === 0) {
            // Default waveform if none provided
            return Array.from({ length: 40 }, (_, i) => (
                <div
                    key={i}
                    className={cn(
                        "w-0.5 rounded-full transition-all",
                        isFromCurrentUser ? "bg-white/30" : "bg-gray-300"
                    )}
                    style={{
                        height: `${Math.random() * 20 + 10}px`,
                    }}
                />
            ));
        }

        return waveform.slice(0, 40).map((amplitude, i) => (
            <div
                key={i}
                className={cn(
                    "w-0.5 rounded-full transition-all",
                    i < (progress / 100) * 40
                        ? isFromCurrentUser
                            ? "bg-white/70"
                            : "bg-blue-500"
                        : isFromCurrentUser
                        ? "bg-white/30"
                        : "bg-gray-300"
                )}
                style={{
                    height: `${amplitude * 30 + 5}px`,
                }}
            />
        ));
    };

    if (!audioUrl) {
        return <div className="text-sm text-muted-foreground">Audio not available</div>;
    }

    return (
        <div
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                isFromCurrentUser ? "bg-blue-500 text-white" : "bg-gray-100"
            )}
        >
            <Button
                size="sm"
                variant="ghost"
                className={cn(
                    "h-10 w-10 p-0 rounded-full",
                    isFromCurrentUser
                        ? "hover:bg-white/20 text-white"
                        : "hover:bg-gray-200"
                )}
                onClick={togglePlayback}
                disabled={isLoading}
            >
                {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isPlaying ? (
                    <Pause className="h-4 w-4" />
                ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                )}
            </Button>

            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1 h-8" ref={progressRef}>
                    {renderWaveform()}
                </div>
                <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                        isFromCurrentUser ? "text-white/80" : "text-gray-600"
                    )}>
                        {formatTime(isPlaying ? currentTime : 0)}
                    </span>
                    <span className={cn(
                        isFromCurrentUser ? "text-white/80" : "text-gray-600"
                    )}>
                        {formatTime(duration)}
                    </span>
                </div>
            </div>

            <a
                href={audioUrl}
                download
                className={cn(
                    "p-2 rounded-full transition-colors",
                    isFromCurrentUser
                        ? "hover:bg-white/20 text-white"
                        : "hover:bg-gray-200 text-gray-600"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <Download className="h-4 w-4" />
            </a>
        </div>
    );
}