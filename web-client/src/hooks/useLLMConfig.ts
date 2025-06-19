import { useCallback, useEffect, useState } from "react";
import type {
    LLMConfig,
    LLMCredentials,
    LLMModelOption,
    LLMProvider,
    SpeechConfig,
    SpeechProvider,
    UnifiedLLMConfig,
} from "../types/llm";
import { SPEECH_MODELS } from "../types/llm";
import {
    getAllModels,
    getModelsForProvider,
    testLLMConfiguration,
    validateApiKeyFormat,
} from "../utils/llmModels";

const STORAGE_KEY = "tenex_llm_config";

export function useLLMConfig() {
    const [config, setConfig] = useState<UnifiedLLMConfig>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (error) {
                console.error("Failed to parse saved LLM config:", error);
            }
        }

        // Default configuration
        return {
            configurations: {},
            defaults: {
                default: undefined,
                titleGeneration: undefined,
            },
            credentials: {},
            speech: undefined,
        };
    });

    const [availableModels, setAvailableModels] = useState<Record<LLMProvider, LLMModelOption[]>>({
        openai: [],
        openrouter: [],
        anthropic: [],
        google: [],
        groq: [],
        deepseek: [],
        ollama: [],
    });

    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Save configuration to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }, [config]);

    // Load available models
    const loadModels = useCallback(async (provider?: LLMProvider) => {
        setIsLoadingModels(true);
        try {
            if (provider) {
                const models = await getModelsForProvider(provider);
                setAvailableModels((prev) => ({
                    ...prev,
                    [provider]: models,
                }));
            } else {
                const allModels = await getAllModels();
                const modelsByProvider = allModels.reduce(
                    (acc, model) => {
                        if (!acc[model.provider]) {
                            acc[model.provider] = [];
                        }
                        acc[model.provider].push(model);
                        return acc;
                    },
                    {} as Record<LLMProvider, LLMModelOption[]>
                );

                setAvailableModels(modelsByProvider);
            }
        } catch (error) {
            console.error("Failed to load models:", error);
        } finally {
            setIsLoadingModels(false);
        }
    }, []);

    // Add or update a configuration
    const addConfiguration = useCallback((name: string, llmConfig: LLMConfig) => {
        setConfig((prev) => ({
            ...prev,
            configurations: {
                ...prev.configurations,
                [name]: llmConfig,
            },
        }));
    }, []);

    // Remove a configuration
    const removeConfiguration = useCallback((name: string) => {
        setConfig((prev) => {
            const { [name]: removed, ...rest } = prev.configurations;
            const newDefaults = { ...prev.defaults };

            // Remove from defaults if it was set as default
            Object.keys(newDefaults).forEach((key) => {
                if (newDefaults[key] === name) {
                    delete newDefaults[key];
                }
            });

            return {
                ...prev,
                configurations: rest,
                defaults: newDefaults,
            };
        });
    }, []);

    // Set credentials for a provider
    const setCredentials = useCallback((provider: LLMProvider, credentials: LLMCredentials) => {
        setConfig((prev) => ({
            ...prev,
            credentials: {
                ...prev.credentials,
                [provider]: credentials,
            },
        }));
    }, []);

    // Remove credentials for a provider
    const removeCredentials = useCallback((provider: LLMProvider) => {
        setConfig((prev) => {
            const { [provider]: removed, ...rest } = prev.credentials;
            return {
                ...prev,
                credentials: rest,
            };
        });
    }, []);

    // Set default configuration for a use case
    const setDefault = useCallback((useCase: string, configName: string) => {
        setConfig((prev) => ({
            ...prev,
            defaults: {
                ...prev.defaults,
                [useCase]: configName,
            },
        }));
    }, []);

    // Configure speech-to-text
    const setSpeechConfig = useCallback(
        (speechConfig: SpeechConfig, credentials: LLMCredentials) => {
            setConfig((prev) => ({
                ...prev,
                speech: {
                    configuration: speechConfig,
                    credentials,
                },
            }));
        },
        []
    );

    // Remove speech configuration
    const removeSpeechConfig = useCallback(() => {
        setConfig((prev) => ({
            ...prev,
            speech: undefined,
        }));
    }, []);

    // Test a configuration
    const testConfiguration = useCallback(
        async (provider: LLMProvider, apiKey: string, model: string): Promise<boolean> => {
            if (!validateApiKeyFormat(provider, apiKey)) {
                throw new Error(`Invalid API key format for ${provider}`);
            }

            return await testLLMConfiguration(provider, apiKey, model);
        },
        []
    );

    // Get configuration for a specific use case
    const getConfigForUseCase = useCallback(
        (useCase: string): LLMConfig | null => {
            const configName = config.defaults[useCase] || config.defaults.default;
            if (!configName || !config.configurations[configName]) {
                return null;
            }
            return config.configurations[configName];
        },
        [config]
    );

    // Get credentials for a provider
    const getCredentials = useCallback(
        (provider: LLMProvider): LLMCredentials | null => {
            return config.credentials[provider] || null;
        },
        [config]
    );

    // Get speech configuration
    const getSpeechConfig = useCallback((): {
        config: SpeechConfig;
        credentials: LLMCredentials;
    } | null => {
        if (!config.speech) return null;
        return {
            config: config.speech.configuration,
            credentials: config.speech.credentials,
        };
    }, [config]);

    // Get available speech models for a provider
    const getSpeechModels = useCallback((provider: SpeechProvider) => {
        return SPEECH_MODELS[provider] || [];
    }, []);

    // Get all configured providers
    const getConfiguredProviders = useCallback((): LLMProvider[] => {
        return Object.keys(config.credentials) as LLMProvider[];
    }, [config]);

    // Check if a provider is configured
    const isProviderConfigured = useCallback(
        (provider: LLMProvider): boolean => {
            return !!config.credentials[provider]?.apiKey;
        },
        [config]
    );

    return {
        config,
        availableModels,
        isLoadingModels,

        // Configuration management
        addConfiguration,
        removeConfiguration,
        getConfigForUseCase,

        // Credentials management
        setCredentials,
        removeCredentials,
        getCredentials,
        getConfiguredProviders,
        isProviderConfigured,

        // Defaults management
        setDefault,

        // Speech configuration
        setSpeechConfig,
        removeSpeechConfig,
        getSpeechConfig,
        getSpeechModels,

        // Model management
        loadModels,

        // Testing
        testConfiguration,
    };
}
