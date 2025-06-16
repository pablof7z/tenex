# Team Formation LLM Configuration

TENEX now supports configuring a specific LLM for team formation analysis, separate from the default orchestrator LLM. This allows you to use specialized models for team formation decisions while using different models for other orchestration tasks.

## Configuration Structure

### 1. LLM Configurations (`.tenex/llms.json`)

First, define your available LLM configurations in your project's `.tenex/llms.json` file:

```json
{
  "ollama-gemma3-12b-it-qat": {
    "provider": "ollama",
    "model": "gemma3:12b-it-qat",
    "enableCaching": false
  },
  "openrouter-anthropic-claude-sonnet-4": {
    "provider": "openrouter",
    "model": "anthropic/claude-sonnet-4",
    "apiKey": "sk-or-v1-...",
    "enableCaching": true
  },
  "openrouter-openai-o3-mini-high": {
    "provider": "openrouter",
    "model": "openai/o3-mini-high",
    "apiKey": "sk-or-v1-...",
    "enableCaching": false
  },
  "default": "ollama-gemma3-12b-it-qat"
}
```

### 2. Team Formation Configuration (in `.tenex/llms.json`)

Add an `orchestrator` section to your existing `.tenex/llms.json` file to specify which LLM to use for team formation:

```json
{
  "ollama-gemma3-12b-it-qat": {
    "provider": "ollama",
    "model": "gemma3:12b-it-qat",
    "enableCaching": false
  },
  "openrouter-anthropic-claude-sonnet-4": {
    "provider": "openrouter",
    "model": "anthropic/claude-sonnet-4",
    "apiKey": "sk-or-v1-...",
    "enableCaching": true
  },
  "openrouter-openai-o3-mini-high": {
    "provider": "openrouter",
    "model": "openai/o3-mini-high",
    "apiKey": "sk-or-v1-...",
    "enableCaching": false
  },
  "default": "ollama-gemma3-12b-it-qat",
  "orchestrator": {
    "llmConfig": "default",
    "teamFormationLLMConfig": "openrouter-anthropic-claude-sonnet-4",
    "maxTeamSize": 5,
    "strategies": {
      "simple": "single_responder",
      "moderate": "hierarchical",
      "complex": "phased_delivery"
    }
  }
}
```

## Configuration Options

### `orchestrator.teamFormationLLMConfig`

- **Type**: `string` (optional)
- **Description**: Specifies which LLM configuration to use specifically for team formation analysis
- **Default**: Uses the same LLM as `orchestrator.llmConfig`
- **Example**: `"openrouter-anthropic-claude-sonnet-4"`

### Key Benefits

1. **Specialized Models**: Use models that excel at analysis and reasoning for team formation decisions
2. **Cost Optimization**: Use more expensive, capable models only for critical team formation decisions
3. **Performance Tuning**: Optimize different aspects of orchestration with different models
4. **Flexibility**: Easily switch team formation models without affecting other orchestration components

## Example Use Cases

### High-Quality Team Formation
Use a powerful model like Claude Sonnet 4 for team formation while using a faster local model for other tasks:

```json
{
  "default": "ollama-gemma3-12b-it-qat",
  "orchestrator": {
    "llmConfig": "default",
    "teamFormationLLMConfig": "openrouter-anthropic-claude-sonnet-4"
  }
}
```

### Cost-Optimized Setup
Use cached models for team formation to reduce API costs:

```json
{
  "default": "ollama-gemma3-12b-it-qat",
  "orchestrator": {
    "llmConfig": "default",
    "teamFormationLLMConfig": "openrouter-anthropic-claude-sonnet-4"
  }
}
```

Make sure the corresponding LLM config has `"enableCaching": true`.

### Specialized Reasoning
Use O3-mini for complex reasoning tasks like team formation:

```json
{
  "default": "ollama-gemma3-12b-it-qat",
  "orchestrator": {
    "llmConfig": "default", 
    "teamFormationLLMConfig": "openrouter-openai-o3-mini-high"
  }
}
```

## Configuration Loading

The system automatically:

1. Loads the orchestration configuration from the `orchestrator` key in `.tenex/llms.json`
2. Falls back to default configuration if the orchestrator section is missing
3. Validates that the specified `teamFormationLLMConfig` exists in the same `llms.json` file
4. Creates separate LLM provider instances for team formation when specified

## Troubleshooting

### Configuration Not Found
If the specified `teamFormationLLMConfig` is not found in `llms.json`, the system will fall back to using the default orchestrator LLM and log a warning.

### Invalid JSON
Ensure your `orchestration.json` file is valid JSON. The system will log parsing errors and fall back to default configuration.

### API Key Issues
Make sure the LLM configuration specified for team formation has the necessary API keys configured in `llms.json`.

## Testing Your Configuration

After setting up your team formation LLM configuration:

1. Start your TENEX project with `tenex project run`
2. Look for log messages indicating which LLM is being used for team formation
3. Monitor team formation decisions to ensure they're using the expected model
4. Check token usage and costs to verify the configuration is working as expected

The team formation analyzer will log which LLM provider it's using, making it easy to verify your configuration is working correctly.