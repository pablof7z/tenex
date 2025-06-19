import { Check, Loader2, Mic, TestTube } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SpeechConfig, SpeechProvider } from "../../types/llm";
import { useLLMConfig } from "../../hooks/useLLMConfig";
import { validateApiKeyFormat } from "../../utils/llmModels";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

const SPEECH_PROVIDER_NAMES: Record<SpeechProvider, string> = {
    openai: "OpenAI Whisper",
    openrouter: "OpenRouter Whisper",
};

const SPEECH_PROVIDER_DESCRIPTIONS: Record<SpeechProvider, string> = {
    openai: "Direct access to OpenAI's Whisper model for speech recognition",
    openrouter: "Access Whisper through OpenRouter's unified API",
};

export function SpeechSettings() {
    const {
        getSpeechConfig,
        setSpeechConfig,
        removeSpeechConfig,
        getSpeechModels,
        setCredentials,
    } = useLLMConfig();

    const [provider, setProvider] = useState<SpeechProvider>("openai");
    const [model, setModel] = useState("whisper-1");
    const [apiKey, setApiKey] = useState("");
    const [language, setLanguage] = useState("");
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<boolean | null>(null);
    const [isRecording, setIsRecording] = useState(false);

    const currentConfig = getSpeechConfig();

    useEffect(() => {
        if (currentConfig) {
            setProvider(currentConfig.config.provider);
            setModel(currentConfig.config.model);
            setLanguage(currentConfig.config.language || "");
            setApiKey(currentConfig.credentials.apiKey || "");
        }
    }, [currentConfig]);

    // Check if there are unsaved changes
    const hasUnsavedChanges = currentConfig
        ? provider !== currentConfig.config.provider ||
          model !== currentConfig.config.model ||
          (language || "") !== (currentConfig.config.language || "") ||
          apiKey !== (currentConfig.credentials.apiKey || "")
        : apiKey !== "";

    const speechModels = getSpeechModels(provider);

    // Update model when provider changes
    useEffect(() => {
        const models = getSpeechModels(provider);
        if (models.length > 0 && !models.find((m) => m.id === model)) {
            setModel(models[0]?.id || "");
        }
    }, [provider, model, getSpeechModels]);

    const testSpeechConfiguration = async (): Promise<boolean> => {
        try {
            // Test by checking if we can access the microphone and the API
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone access not supported");
            }

            // Test microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());

            // Test API configuration (simplified test)
            const baseURL =
                provider === "openai"
                    ? "https://api.openai.com/v1"
                    : "https://openrouter.ai/api/v1";

            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey}`,
            };

            if (provider === "openrouter") {
                headers["HTTP-Referer"] = window.location.origin;
                headers["X-Title"] = "TENEX Web Client";
            }

            // Just test if the endpoint is accessible (we can't test audio without actual audio)
            const response = await fetch(`${baseURL}/models`, {
                method: "GET",
                headers,
            });

            return response.ok;
        } catch (error) {
            console.error("Speech configuration test failed:", error);
            return false;
        }
    };

    const handleTest = async () => {
        if (
            !apiKey ||
            !validateApiKeyFormat(provider === "openrouter" ? "openrouter" : "openai", apiKey)
        ) {
            setTestResult(false);
            return;
        }

        setIsTesting(true);
        try {
            const result = await testSpeechConfiguration();
            setTestResult(result);
        } catch (error) {
            console.error("Test failed:", error);
            setTestResult(false);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = useCallback(() => {
        const speechConfig: SpeechConfig = {
            provider,
            model,
            language: language || undefined,
        };

        const credentials = {
            apiKey,
            baseUrl:
                provider === "openai"
                    ? "https://api.openai.com/v1"
                    : "https://openrouter.ai/api/v1",
        };

        setSpeechConfig(speechConfig, credentials);

        // Also store credentials in the main credentials store
        setCredentials(provider === "openrouter" ? "openrouter" : "openai", credentials);
    }, [provider, model, language, apiKey, setSpeechConfig, setCredentials]);

    const handleRemove = useCallback(() => {
        removeSpeechConfig();
        setTestResult(null);
    }, [removeSpeechConfig]);

    const testRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Microphone access not supported on this browser");
            return;
        }

        setIsRecording(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            // Record for 2 seconds
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                stream.getTracks().forEach((track) => track.stop());

                // Just test the recording, don't actually transcribe
                if (audioBlob.size > 0) {
                    setTestResult(true);
                } else {
                    setTestResult(false);
                }
            };

            mediaRecorder.start();

            // Stop after 2 seconds
            setTimeout(() => {
                if (mediaRecorder.state === "recording") {
                    mediaRecorder.stop();
                }
            }, 2000);
        } catch (error) {
            console.error("Recording test failed:", error);
            setTestResult(false);
            alert("Failed to access microphone. Please check your permissions.");
        } finally {
            setIsRecording(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Speech-to-Text Configuration</h2>
                <p className="text-muted-foreground">
                    Configure speech recognition for voice messages and voice input
                </p>
                {hasUnsavedChanges && (
                    <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
                        You have unsaved changes. Click "Save Changes" to apply them.
                    </p>
                )}
            </div>

            <Card className="p-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="speech-provider">Provider</Label>
                        <Select
                            value={provider}
                            onValueChange={(value: SpeechProvider) => {
                                setProvider(value);
                                // Reset test result when provider changes
                                setTestResult(null);
                                // Update model to match new provider's available models
                                const models = getSpeechModels(value);
                                if (models.length > 0 && !models.find((m) => m.id === model)) {
                                    setModel(models[0]?.id || "");
                                }
                            }}
                        >
                            <SelectTrigger id="speech-provider">
                                <div className="flex items-center justify-between w-full">
                                    <span>{SPEECH_PROVIDER_NAMES[provider] || "Select a provider"}</span>
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(SPEECH_PROVIDER_NAMES).map(
                                    ([providerKey, name]) => (
                                        <SelectItem key={providerKey} value={providerKey}>
                                            {name}
                                        </SelectItem>
                                    )
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                            {SPEECH_PROVIDER_DESCRIPTIONS[provider]}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="speech-api-key">API Key</Label>
                        <div className="flex gap-2">
                            <Input
                                id="speech-api-key"
                                type="password"
                                placeholder={`Enter your ${SPEECH_PROVIDER_NAMES[provider]} API key`}
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setTestResult(null);
                                }}
                                className="flex-1"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTest}
                                disabled={!apiKey || isTesting}
                                className="shrink-0"
                            >
                                {isTesting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : testResult === true ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                    <TestTube className="w-4 h-4" />
                                )}
                                Test API
                            </Button>
                        </div>
                        {testResult === false && (
                            <p className="text-sm text-red-500">
                                API key test failed. Please check your key and try again.
                            </p>
                        )}
                        {!validateApiKeyFormat(
                            provider === "openrouter" ? "openrouter" : "openai",
                            apiKey
                        ) &&
                            apiKey && (
                                <p className="text-sm text-yellow-600">
                                    API key format may be incorrect for{" "}
                                    {SPEECH_PROVIDER_NAMES[provider]}
                                </p>
                            )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="speech-model">Model</Label>
                        <Select value={model} onValueChange={setModel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {speechModels.map((modelOption) => (
                                    <SelectItem key={modelOption.id} value={modelOption.id}>
                                        {modelOption.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="speech-language">Language (optional)</Label>
                        <Input
                            id="speech-language"
                            placeholder="e.g., en, es, fr (leave empty for auto-detection)"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                            Specify language code for better accuracy, or leave empty for automatic
                            detection
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Label>Microphone Test</Label>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={testRecording}
                                disabled={isRecording}
                                className="flex items-center gap-2"
                            >
                                {isRecording ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Mic className="w-4 h-4" />
                                )}
                                {isRecording ? "Recording..." : "Test Microphone"}
                            </Button>
                            {testResult === true && (
                                <div className="flex items-center gap-2 text-green-600">
                                    <Check className="w-4 h-4" />
                                    <span className="text-sm">Microphone working</span>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Test your microphone to ensure voice input will work properly
                        </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <Button
                            onClick={handleSave}
                            disabled={!apiKey || testResult === false}
                            className="flex-1"
                            variant={hasUnsavedChanges ? "primary" : "outline"}
                        >
                            {hasUnsavedChanges ? "Save Changes" : "Save Speech Configuration"}
                        </Button>
                        {currentConfig && (
                            <Button variant="outline" onClick={handleRemove}>
                                Remove
                            </Button>
                        )}
                    </div>

                    {currentConfig && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-medium mb-2">Current Configuration</h4>
                            <div className="text-sm space-y-1">
                                <p>
                                    <span className="font-medium">Provider:</span>{" "}
                                    {SPEECH_PROVIDER_NAMES[currentConfig.config.provider]}
                                </p>
                                <p>
                                    <span className="font-medium">Model:</span>{" "}
                                    {currentConfig.config.model}
                                </p>
                                {currentConfig.config.language && (
                                    <p>
                                        <span className="font-medium">Language:</span>{" "}
                                        {currentConfig.config.language}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
