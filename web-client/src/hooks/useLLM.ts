import { useLLMConfig } from "./useLLMConfig";

export function useLLM() {
    const { config } = useLLMConfig();

    const cleanupText = async (text: string): Promise<string> => {
        try {
            // Check if we have an API configuration
            const openaiConfig = config?.providers?.find((p: any) => p.provider === "openai");
            
            if (!openaiConfig || !openaiConfig.apiKey) {
                // If no API key, do basic cleanup
                return text
                    .split(". ")
                    .join(".\n\n")
                    .trim();
            }

            // Use OpenAI to clean up and format the text
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${openaiConfig.apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: openaiConfig.model || "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful assistant that cleans up transcribed text. Fix any grammar mistakes, add proper punctuation, and break the text into logical paragraphs. Maintain the original meaning and voice. Return only the cleaned text without any additional commentary.",
                        },
                        {
                            role: "user",
                            content: text,
                        },
                    ],
                    temperature: 0.3,
                    max_tokens: 4000,
                }),
            });

            if (!response.ok) {
                throw new Error(`LLM request failed: ${response.statusText}`);
            }

            const result = await response.json();
            return result.choices[0]?.message?.content || text;
        } catch (error) {
            console.error("LLM cleanup error:", error);
            
            // Fallback to basic cleanup
            return text
                .split(". ")
                .join(".\n\n")
                .trim();
        }
    };

    return {
        cleanupText,
    };
}