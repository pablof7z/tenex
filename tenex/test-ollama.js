#!/usr/bin/env bun

// Test Ollama API integration
async function testOllamaModels() {
    try {
        const response = await fetch("http://localhost:11434/api/tags");
        if (!response.ok) {
            throw new Error(`Ollama API returned ${response.status}`);
        }

        const data = await response.json();
        const models = data.models.map((model) => model.name);

        console.log("Available Ollama models:");
        models.forEach((model, index) => {
            console.log(`  ${index + 1}. ${model}`);
        });

        console.log(`\nTotal: ${models.length} models`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.log("Make sure Ollama is running with: ollama serve");
    }
}

testOllamaModels();
