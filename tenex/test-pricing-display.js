// Test the pricing display logic
const _chalk = require("chalk");

// Mock data similar to what we'd get from OpenRouter API
const mockModels = [
    {
        id: "anthropic/claude-3-sonnet:beta",
        name: "Claude 3 Sonnet",
        supportsCaching: true,
        promptPrice: 3.0,
        completionPrice: 15.0,
    },
    {
        id: "openai/gpt-4o",
        name: "GPT-4o",
        supportsCaching: false,
        promptPrice: 2.5,
        completionPrice: 10.0,
    },
    {
        id: "deepseek/deepseek-chat",
        name: "DeepSeek Chat",
        supportsCaching: false,
        promptPrice: 0.14,
        completionPrice: 0.28,
    },
];

// Test the choice formatting logic
const choices = mockModels.map((model) => {
    const cacheInfo = model.supportsCaching ? " [Cache]" : "";
    const pricing = `$${model.promptPrice.toFixed(2)}/$${model.completionPrice.toFixed(2)}`;

    return {
        name: `${model.id}${cacheInfo} - ${pricing}/1M tokens`,
        value: model.id,
        short: model.id,
    };
});

console.log("Expected pricing display in OpenRouter model selection:");
console.log("=".repeat(60));
choices.forEach((choice, index) => {
    console.log(`${index + 1}. ${choice.name}`);
});

console.log("\nThis is what users should see when selecting OpenRouter models!");
