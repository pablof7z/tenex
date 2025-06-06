// Audio recording types and interfaces

export interface AudioRecorderState {
    state: "idle" | "recording" | "paused" | "stopped" | "processing" | "error";
    duration: number;
    audioBlob: Blob | null;
    audioUrl: string | null;
    error: string | null;
}

export interface TranscriptionRequest {
    audio: File;
}

export interface TranscriptionResponse {
    success: boolean;
    transcription: string;
    title: string;
    description: string;
    originalText: string;
    error?: string;
}

export interface TranscriptionError {
    error: string;
    code?: string;
    details?: string;
}

export interface AudioRecorderProps {
    onRecordingComplete?: (audioBlob: Blob, duration: number) => void;
    onError?: (error: string) => void;
    maxDuration?: number;
    className?: string;
}

export interface ParsedTranscription {
    title: string;
    description: string;
}

export interface CorrectionStats {
    originalWordCount: number;
    correctedWordCount: number;
    correctionCount: number;
    corrections: Array<{
        original: string;
        corrected: string;
        position: number;
    }>;
    correctionRate: number;
}

export interface AudioConstraints {
    sampleRate?: number;
    channelCount?: number;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
}

export interface RecordingOptions {
    mimeType?: string;
    audioBitsPerSecond?: number;
    constraints?: AudioConstraints;
}

// Browser compatibility check result
export interface BrowserSupport {
    mediaRecorder: boolean;
    getUserMedia: boolean;
    audioContext: boolean;
    webAudio: boolean;
    supported: boolean;
    issues: string[];
}

// Voice command types for future expansion
export interface VoiceCommand {
    command: string;
    action: "start" | "stop" | "pause" | "resume" | "cancel";
    confidence: number;
}

export interface VoiceCommandConfig {
    enabled: boolean;
    commands: VoiceCommand[];
    threshold: number;
}

// Audio processing utilities
export interface AudioProcessingOptions {
    normalize?: boolean;
    removeNoise?: boolean;
    enhanceVoice?: boolean;
    targetSampleRate?: number;
}

// Transcription service configuration
export interface TranscriptionConfig {
    provider: "openai" | "google" | "azure" | "aws";
    model: string;
    language: string;
    temperature?: number;
    maxRetries?: number;
    timeout?: number;
}

// Error types for better error handling
export type AudioError =
    | "PERMISSION_DENIED"
    | "DEVICE_NOT_FOUND"
    | "RECORDING_FAILED"
    | "TRANSCRIPTION_FAILED"
    | "NETWORK_ERROR"
    | "QUOTA_EXCEEDED"
    | "INVALID_AUDIO_FORMAT"
    | "FILE_TOO_LARGE"
    | "BROWSER_NOT_SUPPORTED";

export interface AudioErrorDetails {
    type: AudioError;
    message: string;
    originalError?: Error;
    retryable: boolean;
    suggestions?: string[];
}

// Hooks return types
export interface UseAudioRecorderReturn {
    state: AudioRecorderState;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    pauseRecording: () => void;
    resumeRecording: () => void;
    cancelRecording: () => void;
    playback: {
        play: () => void;
        pause: () => void;
        stop: () => void;
        seek: (time: number) => void;
        isPlaying: boolean;
        currentTime: number;
    };
}

export interface UseTranscriptionReturn {
    transcribe: (audioBlob: Blob) => Promise<TranscriptionResponse>;
    isTranscribing: boolean;
    error: string | null;
    clearError: () => void;
}

// Configuration for the audio recorder component
export interface AudioRecorderConfig {
    maxDuration: number;
    maxFileSize: number;
    allowedFormats: string[];
    sampleRate: number;
    channelCount: number;
    enablePlayback: boolean;
    enableWaveform: boolean;
    autoCorrection: boolean;
    smartParsing: boolean;
}

// Default configurations
export const DEFAULT_AUDIO_CONFIG: AudioRecorderConfig = {
    maxDuration: 300, // 5 minutes
    maxFileSize: 25 * 1024 * 1024, // 25MB
    allowedFormats: ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"],
    sampleRate: 16000, // Optimal for Whisper
    channelCount: 1, // Mono
    enablePlayback: true,
    enableWaveform: false, // Future feature
    autoCorrection: true,
    smartParsing: true,
};

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
    provider: "openai",
    model: "whisper-1",
    language: "en",
    temperature: 0.2,
    maxRetries: 3,
    timeout: 30000, // 30 seconds
};
