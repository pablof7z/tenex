import { loadModels } from 'multi-llm-ts';

async function testModelCapabilities() {
  const apiKey = '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';
  
  const llmConfig = { 
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1'
  };

  console.log('Loading OpenRouter models...\n');
  const models = await loadModels('openrouter', llmConfig);
  
  console.log('Chat models found:', models.chat.length);
  
  // Check first few models for capabilities
  const sampleModels = models.chat.slice(0, 10);
  
  for (const model of sampleModels) {
    if (typeof model === 'string') {
      console.log(`\nModel: ${model} (string only, no metadata)`);
    } else {
      console.log(`\nModel: ${model.id}`);
      console.log('  Name:', model.name);
      console.log('  Capabilities:', JSON.stringify(model.capabilities) || 'none specified');
      console.log('  Supports tools:', model.capabilities?.tools || false);
      console.log('  Meta:', model.meta ? 'has metadata' : 'no metadata');
      
      // Check if model explicitly supports function calling
      if (model.meta && typeof model.meta === 'object') {
        const meta = model.meta as any;
        console.log('  Context length:', meta.context_length);
        console.log('  Max completion:', meta.top_provider?.max_completion_tokens);
      }
    }
  }
  
  // Look for models that might support tools
  console.log('\n\nSearching for models with tool support...');
  const modelsWithTools = models.chat.filter(m => {
    if (typeof m === 'string') return false;
    return m.capabilities?.tools === true;
  });
  
  console.log(`Found ${modelsWithTools.length} models with explicit tool support`);
  modelsWithTools.forEach(m => {
    if (typeof m !== 'string') {
      console.log(`- ${m.id} (${m.name})`);
    }
  });
}

testModelCapabilities().catch(console.error);