import { useState } from "react";
import { useLLMConfig } from "./useLLMConfig";

export function useSpeechToText() {
    const [isTranscribing, setIsTranscribing] = useState(false);
    const { config } = useLLMConfig();

    const transcribe = async (audioBlob: Blob): Promise<string> => {
        setIsTranscribing(true);
        
        try {
            // Check if we have an API configuration
            const openaiConfig = config?.providers?.find((p: any) => p.provider === "openai");
            
            if (!openaiConfig || !openaiConfig.apiKey) {
                throw new Error("OpenAI API key not configured");
            }

            // Convert blob to File for FormData
            const audioFile = new File([audioBlob], "recording.webm", {
                type: audioBlob.type || "audio/webm",
            });

            // Create form data for Whisper API
            const formData = new FormData();
            formData.append("file", audioFile);
            formData.append("model", "whisper-1");

            // Make request to OpenAI Whisper API
            const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiConfig.apiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Transcription failed: ${response.statusText}`);
            }

            const result = await response.json();
            setIsTranscribing(false);
            
            return result.text || "";
        } catch (error) {
            console.error("Speech-to-text error:", error);
            setIsTranscribing(false);
            
            // Fallback to a placeholder for development
            return "[Transcription placeholder - configure OpenAI API key for actual transcription]";
        }
    };

    return {
        transcribe,
        isTranscribing,
    };
}