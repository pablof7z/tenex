# Native Function Calling Implementation Plan for TENEX (Clean Refactor)

## Executive Summary

This document outlines a clean refactor of TENEX's tool execution system to use native function calling via multi-llm-ts v4.0's Plugin API. Following KISS, DRY, SRP, and YAGNI principles, we'll eliminate the XML-based tool system entirely in favor of a simpler, more maintainable approach.

## Current State

- **Complex XML parsing**: Uses `<tool_use>{JSON}</tool_use>` blocks requiring regex parsing
- **Unreliable**: Depends on LLMs correctly formatting XML in their responses
- **Poor separation of concerns**: Tool execution mixed with response parsing

## Proposed Clean Implementation

### 1. Simple Tool Interface with Structured Parameters

```typescript
// src/tools/types.ts
import type { PluginParameter } from 'multi-llm-ts';

export interface ToolResult {
  output?: string;
  metadata?: Record<string, any>; // For flow control tools like handoff
}

export interface Tool {
  name: string;
  description: string;
  parameters: PluginParameter[];
  execute: (params: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}
```

### 2. Direct Tool-to-Plugin Adapter (KISS)

```typescript
// src/llm/ToolPlugin.ts
import { Plugin, PluginExecutionContext, PluginParameter } from 'multi-llm-ts';
import { Tool, ToolExecutionContext } from '@/tools/types';

export class ToolPlugin extends Plugin {
  constructor(
    private tool: Tool,
    private tenexContext: ToolExecutionContext
  ) {
    super();
  }

  serializeInTools = () => true;
  isEnabled = () => true;
  getName = () => this.tool.name;
  getDescription = () => this.tool.description;
  getParameters = () => this.tool.parameters;
  
  getPreparationDescription = () => `Preparing ${this.tool.name}...`;
  getRunningDescription = () => `Running ${this.tool.name}...`;
  getCompletedDescription = () => `Completed ${this.tool.name}`;

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    // Pass TENEX-specific context to the tool
    const result = await this.tool.execute(parameters, this.tenexContext);
    return result;
  }
}
```

### 3. Simplified LLMRouter (SRP)

```typescript
// src/llm/router.ts
export class LLMRouter implements LLMService {
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const config = this.config.configs[this.resolveConfigKey(request.options)];
    const llm = igniteEngine(config.provider, this.getProviderConfig(config));
    
    // Register tools as plugins with context
    if (request.tools && request.toolContext) {
      request.tools.forEach(tool => 
        llm.addPlugin(new ToolPlugin(tool, request.toolContext))
      );
    }
    
    // Always use the same path - no branching logic
    const model = await this.loadModel(config);
    return llm.complete(model, request.messages, {
      usage: true,
      caching: config.enableCaching
    });
  }
}
```

### 4. Clean Tool Execution in ReasonActLoop

```typescript
// src/agents/execution/ReasonActLoop.ts
export class ReasonActLoop {
  async executeIteration(prompt: string, tools: Tool[]): Promise<IterationResult> {
    const response = await this.llm.complete({
      messages: [...this.messages, new Message('user', prompt)],
      tools
    });

    // Tools are automatically executed by multi-llm-ts
    // We just need to format the results
    const toolResults = response.toolCalls?.map(tc => ({
      tool: tc.name,
      params: tc.params,
      result: tc.result
    })) || [];

    return {
      content: response.content,
      toolsExecuted: toolResults,
      usage: response.usage
    };
  }
}
```

### 5. Example Refactored Tool

```typescript
// src/tools/implementations/readFile.ts
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'The file path to read',
      required: true
    }
  ],
  execute: async ({ path }, context) => {
    const fullPath = path.isAbsolute(path) 
      ? path 
      : path.join(context.projectPath, path);
    const content = await fs.readFile(fullPath, 'utf-8');
    return { output: content };
  }
};
```

## Benefits of Clean Refactor

1. **Simplicity**: No XML parsing, no fallback logic, no complex branching
2. **Reliability**: Native function calling is more reliable than prompt engineering
3. **Maintainability**: Clear separation of concerns, single responsibility
4. **Performance**: Less token usage, faster execution
5. **Type Safety**: Structured parameters provide compile-time checking

## What We're Removing (YAGNI)

1. XML tool parsing (`parseToolUses`, `executeTools`)
2. Tool instruction markdown format
3. Complex tool result formatting
4. Fallback mechanisms
5. Legacy compatibility layers

## Implementation Steps

1. Define new Tool interface with structured parameters
2. Create simple ToolPlugin adapter
3. Update LLMRouter to always use plugins
4. Simplify ReasonActLoop to handle native responses only
5. Refactor existing tools to new format
6. Remove all XML-related code

## Testing Strategy

- Unit tests for each refactored tool
- Integration tests for tool execution flow
- E2E tests for agent-tool interactions
- Remove all XML parsing tests

## Model Compatibility Note

This refactor requires models with native function calling support. Based on testing:
- ✅ Anthropic Claude models (3.5+)
- ✅ OpenAI GPT models (3.5+)
- ✅ Google Gemini models
- ✅ Many other modern models via OpenRouter

The trade-off of limiting to function-capable models is worth the massive simplification and reliability gains.

## Success Metrics

- 100% of tools using native function calling
- Zero XML parsing in codebase
- Reduced code complexity (fewer LOC)
- Improved tool execution success rate
- Faster response times