import type { TranscriptionError, TranscriptionResponse } from "@/types/audio";
import { useCallback, useState } from "react";

interface UseTranscriptionOptions {
    onSuccess?: (result: TranscriptionResponse) => void;
    onError?: (error: string) => void;
    maxRetries?: number;
}

export function useTranscription(options: UseTranscriptionOptions = {}) {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<TranscriptionResponse | null>(null);

    const { onSuccess, onError, maxRetries = 3 } = options;

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const transcribe = useCallback(
        async (audioBlob: Blob): Promise<TranscriptionResponse> => {
            if (!audioBlob) {
                throw new Error("No audio blob provided");
            }

            setIsTranscribing(true);
            setError(null);

            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Transcription attempt ${attempt}/${maxRetries}`);

                    const formData = new FormData();
                    formData.append("audio", audioBlob, "recording.webm");

                    const response = await fetch("/api/transcribe", {
                        method: "POST",
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorData: TranscriptionError = await response.json();
                        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                    }

                    const result: TranscriptionResponse = await response.json();

                    if (!result.success) {
                        throw new Error(result.error || "Transcription failed");
                    }

                    console.log("Transcription successful:", result);
                    setLastResult(result);
                    onSuccess?.(result);

                    return result;
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error("Unknown error occurred");
                    console.error(`Transcription attempt ${attempt} failed:`, lastError);

                    // Don't retry on certain errors
                    if (isNonRetryableError(lastError)) {
                        break;
                    }

                    // Wait before retrying (exponential backoff)
                    if (attempt < maxRetries) {
                        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
            }

            // All attempts failed
            const errorMessage = lastError?.message || "Transcription failed after multiple attempts";
            setError(errorMessage);
            onError?.(errorMessage);
            throw lastError || new Error(errorMessage);
        },
        [maxRetries, onSuccess, onError],
    );

    const transcribeWithFeedback = useCallback(
        async (audioBlob: Blob) => {
            try {
                const result = await transcribe(audioBlob);
                return result;
            } catch (err) {
                // Error is already handled in transcribe function
                throw err;
            } finally {
                setIsTranscribing(false);
            }
        },
        [transcribe],
    );

    return {
        transcribe: transcribeWithFeedback,
        isTranscribing,
        error,
        clearError,
        lastResult,
    };
}

/**
 * Check if an error should not be retried
 */
function isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Don't retry on these types of errors
    const nonRetryablePatterns = [
        "invalid openai api key",
        "audio file too large",
        "invalid audio file type",
        "method not allowed",
        "permission denied",
        "browser not supported",
    ];

    return nonRetryablePatterns.some((pattern) => message.includes(pattern));
}

/**
 * Get user-friendly error message
 */
export function getTranscriptionErrorMessage(error: string): string {
    const lowerError = error.toLowerCase();

    if (lowerError.includes("api key")) {
        return "OpenAI API key is not configured or invalid. Please check your environment settings.";
    }

    if (lowerError.includes("quota") || lowerError.includes("billing")) {
        return "OpenAI API quota exceeded. Please check your billing settings.";
    }

    if (lowerError.includes("rate limit")) {
        return "Too many requests. Please wait a moment and try again.";
    }

    if (lowerError.includes("file too large")) {
        return "Audio file is too large. Please record a shorter message (max 25MB).";
    }

    if (lowerError.includes("invalid audio")) {
        return "Invalid audio format. Please try recording again.";
    }

    if (lowerError.includes("network") || lowerError.includes("fetch")) {
        return "Network error. Please check your internet connection and try again.";
    }

    if (lowerError.includes("timeout")) {
        return "Request timed out. Please try again with a shorter recording.";
    }

    // Default message
    return error || "An unexpected error occurred during transcription.";
}

/**
 * Validate audio blob before transcription
 */
export function validateAudioBlob(blob: Blob): { valid: boolean; error?: string } {
    if (!blob) {
        return { valid: false, error: "No audio data provided" };
    }

    if (blob.size === 0) {
        return { valid: false, error: "Audio file is empty" };
    }

    if (blob.size > 25 * 1024 * 1024) {
        // 25MB limit
        return { valid: false, error: "Audio file is too large (max 25MB)" };
    }

    const validTypes = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"];
    const baseType = blob.type.split(";")[0]; // Remove codec info for comparison
    if (!validTypes.includes(baseType)) {
        return { valid: false, error: `Invalid audio type: ${blob.type}` };
    }

    return { valid: true };
}
