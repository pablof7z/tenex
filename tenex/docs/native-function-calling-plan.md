# Native Function Calling Implementation Plan for TENEX

## Executive Summary

This document outlines a plan to enhance TENEX's tool execution system by implementing native function calling using multi-llm-ts v4.0's Plugin API, while maintaining backward compatibility with the current XML-based tool system.

## Current State

### Existing Implementation
- **Tool Format**: Uses `<tool_use>{JSON}</tool_use>` XML blocks in LLM responses
- **Tool Interface**: Simple `Tool` interface with `name`, `instructions`, and `run()` method
- **Execution**: `toolExecutor.ts` parses XML blocks and executes tools
- **Reliability**: Works across all models but depends on prompt engineering

### Discovered Capability
- multi-llm-ts v4.0 supports native function calling through its Plugin system
- OpenRouter properly forwards function calls for supported models
- Native function calling provides better reliability and streaming status updates

## Proposed Implementation

### 1. Enhanced Tool Interface

First, update the Tool interface to support structured parameters:

```typescript
// src/tools/types.ts
import type { PluginParameter } from 'multi-llm-ts';

export interface Tool {
  name: string;
  instructions: string;
  // NEW: Optional structured parameters for native function calling
  parameters?: PluginParameter[];
  run: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<ToolResult>;
}
```

### 2. Tool-to-Plugin Adapter

Create an adapter class that converts TENEX Tools to multi-llm-ts Plugins:

```typescript
// src/llm/adapters/ToolPluginAdapter.ts
import { Plugin, PluginExecutionContext, PluginParameter } from 'multi-llm-ts';
import { Tool } from '@/tools/types';

export class ToolPluginAdapter extends Plugin {
  constructor(private tool: Tool) {
    super();
  }

  serializeInTools(): boolean { return true; }
  isEnabled(): boolean { return true; }
  getName(): string { return this.tool.name; }
  getDescription(): string { return this.extractDescription(this.tool.instructions); }
  
  getParameters(): PluginParameter[] {
    // Prefer structured definition, fall back to parsing for legacy tools
    if (this.tool.parameters) {
      return this.tool.parameters;
    }
    // Legacy parsing logic as fallback during migration
    return this.parseParametersFromInstructions(this.tool.instructions);
  }

  async execute(context: PluginExecutionContext, parameters: any): Promise<any> {
    const result = await this.tool.run(parameters, { 
      agent: { name: context.model } 
    });
    return result;
  }

  // Helper methods for parsing instructions...
}
```

### 3. Enhanced LLMRouter

Update the LLMRouter to support both native and XML-based tool calling:

```typescript
// src/llm/router.ts
export class LLMRouter implements LLMService {
  private plugins: Map<string, ToolPluginAdapter> = new Map();

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const configKey = this.resolveConfigKey(request.options);
    const config = this.config.configs[configKey];
    
    // Initialize LLM engine
    const llm = igniteEngine(config.provider, llmConfig);
    
    // Check if tools are provided and model supports them
    const hasTools = request.tools && request.tools.length > 0;
    const model = await this.getModel(config);
    const supportsNativeTools = model.capabilities?.tools === true;
    
    if (hasTools && supportsNativeTools) {
      // Native function calling path
      this.registerPlugins(llm, request.tools);
      
      // Use generate() for streaming with tool support
      const stream = await llm.generate(model, request.messages);
      return this.processStreamWithTools(stream);
    } else if (hasTools) {
      // Fallback to XML-based tools
      const enhancedMessages = this.injectToolInstructions(request.messages, request.tools);
      const response = await llm.complete(model, enhancedMessages);
      return this.processXmlToolResponse(response);
    } else {
      // No tools - standard completion
      return await llm.complete(model, request.messages);
    }
  }

  private registerPlugins(llm: any, tools: Tool[]): void {
    for (const tool of tools) {
      const adapter = new ToolPluginAdapter(tool);
      llm.addPlugin(adapter);
      this.plugins.set(tool.name, adapter);
    }
  }
}
```

### 4. Enhanced ReasonActLoop Integration

Instead of creating a new class, integrate unified tool handling directly into the existing ReasonActLoop:

```typescript
// src/agents/execution/ReasonActLoop.ts
export class ReasonActLoop {
  async processLLMResponse(
    response: LlmResponse,
    tools: Tool[]
  ): Promise<ProcessedResponse> {
    let content = response.content || '';
    const toolsExecuted = [];

    // Check for native tool calls first
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Native function calls already executed by multi-llm-ts
      for (const toolCall of response.toolCalls) {
        toolsExecuted.push({
          name: toolCall.name,
          params: toolCall.params,
          result: toolCall.result
        });
      }
      // Native calls may include follow-up content
      content = response.content || this.formatToolResults(toolsExecuted);
    } else if (content.includes('<tool_use>')) {
      // Fallback to XML parsing for legacy support
      const xmlToolResults = await executeTools(content, tools, this.context);
      content = xmlToolResults.content;
      toolsExecuted.push(...xmlToolResults.toolsExecuted);
    }

    return { content, toolsExecuted };
  }
}
```

### 5. Migration Strategy

1. **Phase 1**: Implement adapter and test with select models
2. **Phase 2**: Add capability detection and routing logic
3. **Phase 3**: Gradual rollout with feature flag
4. **Phase 4**: Monitor performance and reliability metrics

## Benefits

1. **Improved Reliability**: Native function calling is more reliable than XML parsing
2. **Better Error Handling**: Get structured errors from the LLM provider
3. **Streaming Updates**: Real-time status updates during tool execution
4. **Provider Optimization**: Each provider's native implementation is optimized
5. **Backward Compatibility**: XML fallback ensures all models still work

## Risks and Mitigations

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Comprehensive test suite, feature flags, gradual rollout

2. **Risk**: Inconsistent behavior across providers
   - **Mitigation**: Unified response handler, extensive testing per provider

3. **Risk**: Performance regression
   - **Mitigation**: Benchmark both approaches, optimize adapter layer

## Testing Plan

1. Unit tests for ToolPluginAdapter
2. Integration tests for each provider
3. E2E tests comparing native vs XML approaches
4. Performance benchmarks
5. Reliability metrics collection

## Success Metrics

- Tool execution success rate improves by >20%
- Reduced parsing errors (<1% vs current ~5%)
- No regression in response time
- All existing tools continue to work
- Positive developer feedback on reliability

## Timeline

- Week 1: Implement ToolPluginAdapter and tests
- Week 2: Update LLMRouter with capability detection
- Week 3: Implement unified response handler
- Week 4: Testing and benchmarking
- Week 5: Gradual rollout with monitoring

## Questions for Review

1. Should we expose native function calling as a configuration option?
2. How should we handle streaming vs non-streaming for tool calls?
3. Should tool instructions format change to better support parameter extraction?
4. What telemetry should we add to compare approaches?
5. How do we handle models that claim tool support but don't work well?