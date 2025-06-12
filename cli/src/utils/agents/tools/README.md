# LLM Tool System

This directory contains the tool system that enables LLMs to execute functions and interact with external systems.

## Architecture Overview

### Core Components

1. **ToolRegistry** - Manages tool definitions and generates provider-specific formats
2. **ToolParser** - Detects and parses tool calls from LLM responses
3. **ToolExecutor** - Executes tools and handles results
4. **ToolEnabledProvider** - Wraps LLM providers to add tool support

### Tool Definition Format

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute: (params: Record<string, any>) => Promise<ToolResult>;
}
```

## Usage

### 1. Create and Register Tools

```typescript
import { ToolRegistry } from './tools';
import type { ToolDefinition } from './tools/types';

const registry = new ToolRegistry();

// Define a tool
const weatherTool: ToolDefinition = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: [
    {
      name: 'location',
      type: 'string',
      description: 'City name or coordinates',
      required: true
    }
  ],
  execute: async (params) => {
    // Implementation
    const weather = await fetchWeather(params.location);
    return {
      success: true,
      output: `Weather in ${params.location}: ${weather}`
    };
  }
};

// Register the tool
registry.register(weatherTool);
```

### 2. Create Agent with Tools

```typescript
import { Agent } from '../Agent';

const agent = new Agent(
  'assistant',
  nsec,
  config,
  storage,
  projectName,
  registry // Pass the tool registry
);
```

### 3. Tool Call Format

The system supports multiple tool call formats:

#### XML Format (Recommended)
```xml
<tool_use>
{
  "tool": "get_weather",
  "arguments": {
    "location": "San Francisco"
  }
}
</tool_use>
```

#### Anthropic Format
```json
{
  "type": "tool_use",
  "name": "get_weather",
  "input": {
    "location": "San Francisco"
  }
}
```

## Example Tools

The `examples/` directory contains several pre-built tools:

- **read_file** - Read file contents
- **write_file** - Write content to files
- **shell** - Execute shell commands
- **search_files** - Search for files using glob patterns
- **get_time** - Get current time in various formats

## Provider Support

- **Anthropic**: Full support with native tool format
- **OpenAI**: Function calling support
- **OpenRouter**: Pass-through support for compatible models

## System Prompt Enhancement

When tools are available, the system automatically adds instructions to the system prompt explaining how to use tools. This is handled by `ToolRegistry.generateSystemPrompt()`.

## Tool Response Flow

1. LLM generates response with tool calls
2. ToolParser extracts tool calls from response
3. ToolExecutor runs the tools
4. Tool results are added to conversation
5. LLM generates final response with tool results

## Best Practices

1. **Clear Descriptions**: Provide detailed descriptions for tools and parameters
2. **Error Handling**: Always handle errors in tool implementations
3. **Type Safety**: Use TypeScript types for parameters
4. **Validation**: Validate inputs before executing tools
5. **Security**: Be cautious with tools that execute system commands

## Extending the System

### Adding New Tool Formats

To support new LLM providers, extend the ToolParser with new patterns:

```typescript
// In ToolParser.ts
const newProviderPattern = /your-pattern-here/g;
// Add parsing logic
```

### Custom Tool Registries

Create specialized registries for different domains:

```typescript
class FileSystemToolRegistry extends ToolRegistry {
  constructor() {
    super();
    // Register file system tools
  }
}
```