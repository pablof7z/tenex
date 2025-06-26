#!/usr/bin/env node

const { igniteEngine, loadModels, Message } = require('multi-llm-ts');
const readline = require('node:readline');

async function startREPL() {
    // Check for API key
    if (!process.env.API_KEY) {
        console.error('❌ Please set API_KEY environment variable');
        process.exit(1);
    }

    // Get model from command line arg
    const model = process.argv[2] || 'openai/gpt-3.5-turbo';
    
    console.log('🚀 Multi-LLM-TS OpenRouter REPL');
    console.log(`🤖 Model: ${model}`);
    console.log('💡 Type your messages. Press Ctrl+C to exit.\n');

    // Configuration parameters
    const llmConfig = {
        apiKey: process.env.API_KEY,
        baseURL: 'https://openrouter.ai/api/v1'
    };

    try {
        // Initialize engine and load models (exactly like router.ts)
        const llm = igniteEngine('openrouter', llmConfig);
        const models = await loadModels('openrouter', llmConfig);
        
        if (!models || !models.chat || models.chat.length === 0) {
            throw new Error('No models available for provider openrouter');
        }
        
        // Find the specific model or use first one
        const foundModel = models.chat.find(m => {
            const modelId = typeof m === 'string' ? m : m.id;
            return modelId === model;
        }) || models.chat[0];
        
        console.log(`✅ Found model: ${typeof foundModel === 'string' ? foundModel : foundModel.id}\n`);
        
        // Patch the HTTP client to intercept requests
        const originalComplete = llm.complete.bind(llm);
        llm.complete = async (modelToUse, messages, options) => {
            // Show the full payload being sent
            console.log('\n📤 FULL OUTGOING PAYLOAD:');
            console.log('='.repeat(60));
            const payload = {
                model: typeof modelToUse === 'string' ? modelToUse : modelToUse.id || modelToUse,
                messages: messages,
                ...options
            };
            console.log(JSON.stringify(payload, null, 2));
            console.log('='.repeat(60));
            console.log('\n⏳ Sending request...\n');
            
            // Call original method
            return originalComplete(modelToUse, messages, options);
        };

        // Conversation history
        const messages = [];

        // Create readline interface
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });

        rl.prompt();

        rl.on('line', async (line) => {
            const userInput = line.trim();
            
            if (!userInput) {
                rl.prompt();
                return;
            }

            // Add user message using Message class
            messages.push(new Message('user', userInput));

            try {
                // Make completion call using foundModel (exactly like router.ts)
                const response = await llm.complete(foundModel, messages);

                console.log('📥 FULL INCOMING RESPONSE:');
                console.log('='.repeat(60));
                console.log(JSON.stringify(response, null, 2));
                console.log('='.repeat(60));
                console.log('\n');

                // Add assistant response to conversation using Message class
                messages.push(new Message('assistant', response.content));

                console.log(`💬 Assistant: ${response.content}\n`);

            } catch (error) {
                console.error('❌ Error:', error.message);
                if (error.response) {
                    console.error('📄 Response data:', JSON.stringify(error.response.data, null, 2));
                }
                console.log('');
            }

            rl.prompt();
        });

        rl.on('close', () => {
            console.log('\n👋 Goodbye!');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Initialization error:', error.message);
        process.exit(1);
    }
}

// Run the REPL
startREPL().catch(console.error);