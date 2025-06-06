"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { AudioRecorder } from "@/components/ui/audio-recorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTranscription } from "@/hooks/useTranscription";

export default function TestAudioPage() {
    const [transcriptionResult, setTranscriptionResult] = useState<{
        title: string;
        description: string;
        originalText: string;
        correctedText: string;
    } | null>(null);

    const { transcribe, isTranscribing, error, clearError } = useTranscription({
        onSuccess: (result) => {
            setTranscriptionResult({
                title: result.title,
                description: result.description,
                originalText: result.originalText,
                correctedText: result.transcription,
            });
        },
        onError: (error) => {
            console.error("Transcription error:", error);
        },
    });

    const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
        console.log("Recording completed:", { size: audioBlob.size, duration, type: audioBlob.type });

        try {
            await transcribe(audioBlob);
        } catch (err) {
            console.error("Failed to transcribe:", err);
        }
    };

    const handleRecordingError = (error: string) => {
        console.error("Recording error:", error);
    };

    const clearResults = () => {
        setTranscriptionResult(null);
        clearError();
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Voice Recording Test</h1>
                    <p className="text-muted-foreground mt-2">
                        Test the audio recording and transcription functionality
                    </p>
                </div>

                {/* Audio Recorder */}
                <Card>
                    <CardHeader>
                        <CardTitle>Audio Recorder</CardTitle>
                        <CardDescription>Record your voice to test the audio recording functionality</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AudioRecorder
                            onRecordingComplete={handleRecordingComplete}
                            onError={handleRecordingError}
                            maxDuration={300} // 5 minutes
                            className="w-full"
                        />
                    </CardContent>
                </Card>

                {/* Transcription Status */}
                {(isTranscribing || error) && (
                    <Card>
                        <CardContent className="pt-6">
                            {isTranscribing && (
                                <div className="flex items-center gap-2 text-blue-600">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Transcribing audio...</span>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-start gap-2 text-red-600">
                                    <AlertCircle className="h-4 w-4 mt-0.5" />
                                    <div>
                                        <p className="font-medium">Transcription Error</p>
                                        <p className="text-sm">{error}</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Transcription Results */}
                {transcriptionResult && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        Transcription Results
                                    </CardTitle>
                                    <CardDescription>
                                        Your voice has been successfully transcribed and parsed
                                    </CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={clearResults}>
                                    Clear Results
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Parsed Title */}
                            <div className="space-y-2">
                                <Label htmlFor="parsed-title">Parsed Title</Label>
                                <Input
                                    id="parsed-title"
                                    value={transcriptionResult.title}
                                    readOnly
                                    className="bg-green-50 border-green-200"
                                />
                            </div>

                            {/* Parsed Description */}
                            <div className="space-y-2">
                                <Label htmlFor="parsed-description">Parsed Description</Label>
                                <Textarea
                                    id="parsed-description"
                                    value={transcriptionResult.description}
                                    readOnly
                                    rows={3}
                                    className="bg-green-50 border-green-200"
                                />
                            </div>

                            <Separator />

                            {/* Original vs Corrected Text */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>
                                        Original Transcription
                                        <Badge variant="secondary" className="ml-2">
                                            Raw
                                        </Badge>
                                    </Label>
                                    <Textarea
                                        value={transcriptionResult.originalText}
                                        readOnly
                                        rows={4}
                                        className="bg-gray-50 border-gray-200 text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>
                                        Corrected Text
                                        <Badge variant="default" className="ml-2">
                                            Processed
                                        </Badge>
                                    </Label>
                                    <Textarea
                                        value={transcriptionResult.correctedText}
                                        readOnly
                                        rows={4}
                                        className="bg-blue-50 border-blue-200 text-sm"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>How to Test</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                            <li>Click "Start Recording" to begin recording your voice</li>
                            <li>Speak clearly about a task you want to create</li>
                            <li>
                                Try saying something like: "Create a login page. We need to implement user
                                authentication with email and password validation."
                            </li>
                            <li>Click "Stop" when you're done recording</li>
                            <li>The audio will be automatically transcribed and parsed into title and description</li>
                            <li>Review the results to see how well the parsing worked</li>
                        </ol>

                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> Make sure you have set up your OpenAI API key in the environment
                                variables for transcription to work.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
