# Team Formation LLM Setup Guide

This guide explains how to configure team formation LLM using the `tenex setup` command.

## Overview

TENEX now supports configuring a specific LLM for team formation analysis through the interactive setup menu. This allows you to use specialized models for team formation decisions while using different models for other orchestration tasks.

## Usage

### 1. Navigate to Project Directory

First, make sure you're in a TENEX project directory:

```bash
cd /path/to/your/tenex/project
```

### 2. Run Setup Command with Project Flag

Use the `--project` flag to configure project-specific settings:

```bash
tenex setup llm --project
```

### 3. Configure Team Formation LLM

In the LLM configuration menu, you'll see a new option "Configure team formation LLM" (only available for project-specific setup):

```
🤖 LLM Configuration Manager (project)

Current configurations:
  1. ollama-gemma3-12b (default)
     ollama - gemma3:12b-it-qat
  2. openrouter-claude-sonnet
     openrouter - anthropic/claude-sonnet-4
  3. openrouter-o3-mini
     openrouter - openai/o3-mini-high

? What would you like to do?
  Add new LLM configuration
  Test existing configuration
  Edit existing configuration
  Remove configuration
  Set default configuration
❯ Configure team formation LLM
  Exit
```

### 4. Select Team Formation LLM

When you select "Configure team formation LLM", you'll see:

```
🎯 Team Formation LLM Configuration

Configure which LLM to use specifically for team formation analysis.
This allows using specialized models for team formation decisions.

Available LLM configurations:
  1. ollama-gemma3-12b (default)
     ollama - gemma3:12b-it-qat
  2. openrouter-claude-sonnet
     openrouter - anthropic/claude-sonnet-4
  3. openrouter-o3-mini (team formation)
     openrouter - openai/o3-mini-high

? Select LLM for team formation:
❯ ollama-gemma3-12b (ollama - gemma3:12b-it-qat)
  openrouter-claude-sonnet (openrouter - anthropic/claude-sonnet-4)
  openrouter-o3-mini (openrouter - openai/o3-mini-high)
  Use default LLM (same as orchestrator)
  Clear team formation LLM setting
```

## Configuration Options

### Use Specific LLM
Select any of your configured LLM configurations to use specifically for team formation analysis.

### Use Default LLM
Choose "Use default LLM (same as orchestrator)" to use the same LLM for both general orchestration and team formation.

### Clear Setting
Choose "Clear team formation LLM setting" to remove the team formation LLM configuration and fall back to the default orchestrator LLM.

## Configuration Storage

The team formation LLM setting is stored in `.tenex/llms.json` under the `orchestrator` key:

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
  "default": "ollama-gemma3-12b-it-qat",
  "orchestrator": {
    "llmConfig": "default",
    "teamFormationLLMConfig": "openrouter-anthropic-claude-sonnet-4",
    "maxTeamSize": 5,
    "strategies": {}
  }
}
```

## Use Cases

### High-Quality Team Formation
Use a powerful model like Claude Sonnet 4 for team formation while using a faster local model for other tasks:

```
Default orchestrator: ollama-gemma3-12b (fast, local)
Team formation: openrouter-claude-sonnet (powerful, cloud)
```

### Cost Optimization
Use different models based on cost considerations:

```
Default orchestrator: openrouter-o3-mini (cost-effective)
Team formation: openrouter-claude-sonnet (higher quality, used less frequently)
```

### Specialized Reasoning
Use models optimized for different types of reasoning:

```
Default orchestrator: ollama-gemma3-12b (general purpose)
Team formation: openrouter-o3-mini (reasoning-optimized)
```

## Visual Indicators

The setup menu shows visual indicators for easy identification:

- **default** - The default LLM configuration (yellow)
- **team formation** - Currently configured for team formation (blue)

Example:
```
  1. ollama-gemma3-12b (default)
  2. openrouter-claude-sonnet (team formation)
  3. openrouter-o3-mini
```

## Global vs Project Configuration

- **Global setup** (`tenex setup llm`): Manages your global LLM configurations
- **Project setup** (`tenex setup llm --project`): Manages project-specific LLM configurations and team formation settings

**Note**: Team formation LLM configuration is only available in project-specific setup mode.

## Verification

After configuring the team formation LLM, you can verify the setting by:

1. Checking the `orchestrator` section in `.tenex/llms.json` file in your project
2. Running `tenex setup llm --project` again and looking for the "(team formation)" indicator
3. Starting your project with `tenex project run` and checking the logs for team formation LLM usage

## Troubleshooting

### Option Not Visible
If you don't see "Configure team formation LLM" in the menu:
- Make sure you're using the `--project` flag: `tenex setup llm --project`
- Ensure you're in a TENEX project directory (contains `.tenex` folder)
- Make sure you have at least one LLM configuration defined

### Configuration Not Applied
If the team formation LLM configuration doesn't seem to be working:
- Verify the `orchestrator` section in `.tenex/llms.json` contains the `teamFormationLLMConfig` setting
- Check that the specified LLM configuration exists in the same `.tenex/llms.json` file
- Restart your `tenex project run` session to pick up the new configuration

### Invalid LLM Reference
If you see errors about missing LLM configurations:
- The team formation LLM config references an LLM name that doesn't exist in `.tenex/llms.json`
- Use `tenex setup llm --project` to either add the missing LLM or change the team formation setting

## Integration with Existing Orchestration

The team formation LLM configuration integrates seamlessly with the existing orchestration system:

1. **Team Formation Analysis**: Uses the specified team formation LLM to analyze requests and determine optimal team composition
2. **Task Execution**: Uses the default orchestrator LLM (or agent-specific LLMs) for actual task execution
3. **Fallback Behavior**: If team formation LLM is not configured or fails, falls back to the default orchestrator LLM

This allows for sophisticated orchestration setups where different aspects of the system use different models optimized for their specific tasks.