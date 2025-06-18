/**
 * Utility functions for OpenAI and OpenRouter integration
 */

import type { LLMTitleGenerationError } from '../types/llm';

/**
 * Get the current LLM configuration from the unified configuration system
 */
function getLLMConfig() {
    try {
        const configStr = localStorage.getItem('tenex_llm_config');
        if (!configStr) {
            return null;
        }

        const config = JSON.parse(configStr);
        const defaultConfigName = config.defaults?.titleGeneration || config.defaults?.default;
        
        if (!defaultConfigName || !config.configurations[defaultConfigName]) {
            return null;
        }

        const llmConfig = config.configurations[defaultConfigName];
        const credentials = config.credentials[llmConfig.provider];

        if (!credentials?.apiKey) {
            return null;
        }

        return {
            provider: llmConfig.provider,
            apiKey: credentials.apiKey,
            model: llmConfig.model,
            baseUrl: credentials.baseUrl,
        };
    } catch (error) {
        console.error('Failed to parse LLM config:', error);
        return null;
    }
}

/**
 * Generate a thread title based on user input using configured LLM
 * @param userInput The user's first message in the thread
 * @returns Promise<string> The generated title
 * @throws LLMTitleGenerationError
 */
export async function generateThreadTitle(userInput: string): Promise<string> {
    const config = getLLMConfig();
    
    if (!config) {
        const error = new Error("LLM API key not found. Please configure it in settings.") as LLMTitleGenerationError;
        error.code = 'NO_API_KEY';
        throw error;    
    }

    // Clean and truncate input for title generation
    const cleanInput = userInput.trim().slice(0, 500); // Limit input length
    
    if (!cleanInput) {
        return "New Thread";
    }

    try {
        const baseURL = config.baseUrl || (config.provider === 'openai' 
            ? "https://api.openai.com/v1"
            : "https://openrouter.ai/api/v1");
        
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        };

        // Add OpenRouter-specific headers
        if (config.provider === 'openrouter') {
            headers["HTTP-Referer"] = window.location.origin;
            headers["X-Title"] = "TENEX Web Client";
        }

        const response = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: config.model,
                messages: [
                    {
                        role: "system",
                        content: "Generate a concise, descriptive title (max 50 characters) for a development thread based on the user's message. Focus on the main topic or action. Return only the title without quotes or extra text."
                    },
                    {
                        role: "user",
                        content: cleanInput
                    }
                ],
                max_tokens: 20,
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const providerName = config.provider === 'openai' ? 'OpenAI' : 'OpenRouter';
            const error = new Error(`${providerName} API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`) as LLMTitleGenerationError;
            error.code = 'API_ERROR';
            throw error;
        }

        const data = await response.json();
        
        if (!data.choices?.[0]?.message?.content) {
            const providerName = config.provider === 'openai' ? 'OpenAI' : 'OpenRouter';
            const error = new Error(`Invalid response from ${providerName} API`) as LLMTitleGenerationError;
            error.code = 'INVALID_RESPONSE';
            throw error;
        }

        const generatedTitle = data.choices[0].message.content.trim();
        
        // Ensure title is not too long and clean it up
        return generatedTitle.slice(0, 50).replace(/['"]/g, '');
        
    } catch (error) {
        if (error instanceof Error && 'code' in error) {
            throw error; // Re-throw LLMTitleGenerationError
        }
        
        // Network or other errors
        const apiError = new Error(`Failed to generate title: ${error instanceof Error ? error.message : 'Unknown error'}`) as LLMTitleGenerationError;
        apiError.code = 'API_ERROR';
        throw apiError;
    }
}