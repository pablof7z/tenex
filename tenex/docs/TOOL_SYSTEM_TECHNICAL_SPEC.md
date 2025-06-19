# Tool System Technical Specification

## Overview

The TENEX Tool System provides an extensible framework for giving AI agents capabilities to interact with the system, file system, and external services. It supports dynamic tool registration, agent-specific tool availability, priority-based selection, and seamless integration with various LLM providers including Claude Code's extensive toolset.

## Architecture

```
┌─────────────────────────────────────────────────┐
│            Agent Layer                           │
│     Agent uses tools during response generation  │
├─────────────────────────────────────────────────┤
│          Tool Execution Layer                    │
│     ToolExecutor, ToolParser                    │
├─────────────────────────────────────────────────┤
│         Tool Registry Layer                      │
│     ToolRegistry, ToolManager                   │
├─────────────────────────────────────────────────┤
│          Tool Implementation Layer               │
│  Individual tool implementations (readSpecs,     │
│  updateSpec, claudeCode tools, etc.)            │
└─────────────────────────────────────────────────┘
```

## Core Components

### 1. ToolRegistry (`tools/ToolRegistry.ts`)

The central registry managing all available tools for an agent:

**Key Features:**
- **Tool Storage**: Map of tool name to tool definition
- **Priority Management**: Tools can have priorities for selection
- **Dynamic Registration**: Add/remove tools at runtime
- **Tool Discovery**: List available tools with metadata

**Core Methods:**
```typescript
class ToolRegistry {
    register(tool: Tool): void;
    unregister(toolName: string): void;
    get(toolName: string): Tool | undefined;
    has(toolName: string): boolean;
    list(): Tool[];
    getToolDefinitions(): ToolDefinition[];
}
```

**Tool Structure:**
```typescript
interface Tool {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
    execute: (params: any) => Promise<any>;
    priority?: number;
    availability?: ToolAvailability;
}
```

### 2. ToolManager (`tools/ToolManager.ts`)

Manages tool registries for multiple agents:

**Responsibilities:**
- **Registry Creation**: Create agent-specific tool registries
- **Tool Distribution**: Manage which tools are available to which agents
- **Special Tool Enabling**: Enable agent-specific tools based on capabilities
- **Global Tool Management**: Tools available to all agents

**Key Methods:**
```typescript
class ToolManager {
    createAgentRegistry(agentName: string): ToolRegistry;
    enableRememberLessonTool(agentName: string, eventId: string, ndk: NDK): void;
    enableFindAgentTool(agentName: string, isOrchestrator: boolean): void;
    registerGlobalTool(tool: Tool): void;
}
```

### 3. ToolExecutor

Executes tools safely with error handling:

**Features:**
- **Parameter Validation**: Validates inputs against schema
- **Error Handling**: Catches and reports tool failures
- **Execution Context**: Provides context to tools during execution
- **Result Formatting**: Ensures consistent output format

**Execution Flow:**
```typescript
async function executeTool(toolName: string, params: any): Promise<ToolResult> {
    // 1. Validate tool exists
    // 2. Validate parameters
    // 3. Execute with error handling
    // 4. Format and return result
}
```

### 4. ToolParser

Parses tool calls from LLM responses:

**Capabilities:**
- **Format Detection**: Identifies tool call blocks in responses
- **Parameter Extraction**: Extracts tool parameters from various formats
- **Multi-tool Support**: Handles multiple tool calls in one response
- **Error Recovery**: Handles malformed tool calls gracefully

**Supported Formats:**
```xml
<tool_use>
<tool_name>read_file</tool_name>
<parameters>
<path>/path/to/file.ts</path>
</parameters>
</tool_use>
```

## Tool Categories

### 1. TENEX-Specific Tools

#### readSpecs (`tools/readSpecs.ts`)
**Purpose**: Access living documentation from Nostr events
```typescript
{
    name: "read_specs",
    description: "Read project specifications and documentation",
    parameters: {
        type: "object",
        properties: {
            specName: { type: "string", description: "Name of spec to read (e.g., 'SPEC', 'ARCHITECTURE')" }
        }
    }
}
```

#### updateSpec (`tools/updateSpec.ts`) 
**Purpose**: Update project specifications (default agent only)
```typescript
{
    name: "update_spec",
    description: "Update project specification document",
    parameters: {
        type: "object",
        properties: {
            specName: { type: "string" },
            content: { type: "string" },
            summary: { type: "string" }
        }
    }
}
```
**Special**: Uses project nsec for signing, ensuring consistent authorship

#### rememberLesson (`tools/rememberLesson.ts`)
**Purpose**: Record learnings from mistakes
```typescript
{
    name: "remember_lesson",
    description: "Record a lesson learned from a mistake",
    parameters: {
        type: "object",
        properties: {
            title: { type: "string" },
            lesson: { type: "string" },
            context: { type: "string" }
        }
    }
}
```

#### findAgent (`tools/findAgent.ts`)
**Purpose**: Locate and summon other agents
```typescript
{
    name: "find_agent",
    description: "Find information about another agent",
    parameters: {
        type: "object",
        properties: {
            query: { type: "string" },
            capability: { type: "string" }
        }
    }
}
```

### 2. Claude Code Tools Integration

The system integrates with Claude Code's extensive toolset:

#### File Operations
- `read_file`: Read file contents
- `write_file`: Write to files
- `edit_file`: Make targeted edits
- `create_directory`: Create directories
- `list_directory`: List directory contents

#### Code Analysis
- `search_code`: Search for patterns in code
- `analyze_dependencies`: Analyze project dependencies
- `find_references`: Find symbol references

#### Execution
- `run_command`: Execute shell commands
- `run_tests`: Run test suites
- `build_project`: Build the project

#### Git Operations
- `git_status`: Check repository status
- `git_commit`: Create commits
- `git_diff`: View changes

### 3. Tool Registration Process

```typescript
// 1. Define the tool
const myTool: Tool = {
    name: "my_tool",
    description: "Does something useful",
    parameters: {
        type: "object",
        properties: {
            input: { type: "string", required: true }
        }
    },
    execute: async (params) => {
        // Tool implementation
        return { result: "success" };
    }
};

// 2. Register globally
toolManager.registerGlobalTool(myTool);

// 3. Or register for specific agent
const agentRegistry = toolManager.createAgentRegistry("code");
agentRegistry.register(myTool);
```

## Tool Execution Flow

### 1. During Response Generation

```typescript
// In Agent.generateResponse()
const response = await llmProvider.generateResponse({
    messages: conversation.messages,
    toolDefinitions: toolRegistry.getToolDefinitions()
});

// Parse tool calls from response
const toolCalls = ToolParser.parse(response.content);

// Execute each tool
for (const call of toolCalls) {
    const result = await toolRegistry.execute(call.name, call.parameters);
    // Include result in continued generation
}
```

### 2. Tool Selection by LLM

The LLM receives tool definitions in its context:
```json
{
    "tools": [
        {
            "name": "read_file",
            "description": "Read contents of a file",
            "input_schema": {
                "type": "object",
                "properties": {
                    "path": { "type": "string" }
                },
                "required": ["path"]
            }
        }
    ]
}
```

### 3. Error Handling

```typescript
try {
    const result = await tool.execute(params);
    return { success: true, result };
} catch (error) {
    return { 
        success: false, 
        error: error.message,
        toolName: tool.name 
    };
}
```

## Agent-Specific Tool Configuration

### 1. Tool Availability Rules

```typescript
// Default agent gets all tools
if (agentName === "default") {
    registry.register(updateSpecTool);
    registry.register(manageProjectTool);
}

// Orchestrators get agent management tools
if (agent.hasOrchestrationCapability) {
    registry.register(findAgentTool);
    registry.register(summonAgentTool);
}

// All agents with eventId can learn
if (agent.eventId) {
    registry.register(rememberLessonTool);
}
```

### 2. Dynamic Tool Enabling

```typescript
// Enable tool based on runtime conditions
if (projectContext.hasTests) {
    registry.register(runTestsTool);
}

// Disable tool temporarily
registry.unregister("dangerous_tool");

// Re-enable when safe
registry.register(dangerousTool);
```

## Tool Development Guidelines

### 1. Tool Implementation Best Practices

```typescript
const goodTool: Tool = {
    name: "good_tool",
    description: "Clear, concise description of what this tool does",
    parameters: {
        type: "object",
        properties: {
            // Use descriptive parameter names
            filePath: { 
                type: "string", 
                description: "Absolute path to the file"
            },
            // Include validation constraints
            limit: { 
                type: "number", 
                minimum: 1, 
                maximum: 1000 
            }
        },
        required: ["filePath"] // Clearly mark required params
    },
    execute: async (params) => {
        // 1. Validate inputs beyond schema
        if (!path.isAbsolute(params.filePath)) {
            throw new Error("Path must be absolute");
        }
        
        // 2. Implement with error handling
        try {
            const result = await performOperation(params);
            
            // 3. Return structured result
            return {
                success: true,
                data: result,
                metadata: { timestamp: Date.now() }
            };
        } catch (error) {
            // 4. Provide helpful error messages
            throw new Error(`Failed to process ${params.filePath}: ${error.message}`);
        }
    }
};
```

### 2. Parameter Schema Design

```typescript
// Use JSON Schema for rich validation
const schema = {
    type: "object",
    properties: {
        // Enums for constrained choices
        action: { 
            type: "string", 
            enum: ["read", "write", "delete"] 
        },
        // Arrays with item validation
        tags: {
            type: "array",
            items: { type: "string" },
            maxItems: 10
        },
        // Nested objects
        options: {
            type: "object",
            properties: {
                recursive: { type: "boolean" },
                timeout: { type: "number" }
            }
        }
    },
    // Conditional requirements
    if: { properties: { action: { const: "write" } } },
    then: { required: ["content"] }
};
```

### 3. Tool Composability

Tools can use other tools:

```typescript
const composableTool: Tool = {
    name: "analyze_and_fix",
    execute: async (params, context) => {
        // Use another tool
        const analysis = await context.toolRegistry.execute("analyze_code", {
            path: params.path
        });
        
        if (analysis.issues.length > 0) {
            // Use another tool based on results
            await context.toolRegistry.execute("fix_issues", {
                issues: analysis.issues
            });
        }
        
        return { fixed: analysis.issues.length };
    }
};
```

## Performance Considerations

### 1. Tool Caching

```typescript
class CachedTool implements Tool {
    private cache = new Map<string, any>();
    
    async execute(params: any): Promise<any> {
        const cacheKey = JSON.stringify(params);
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const result = await this.performOperation(params);
        this.cache.set(cacheKey, result);
        
        return result;
    }
}
```

### 2. Parallel Tool Execution

```typescript
// Execute independent tools in parallel
const toolCalls = [
    { name: "read_file", params: { path: "/a.ts" } },
    { name: "read_file", params: { path: "/b.ts" } },
    { name: "git_status", params: {} }
];

const results = await Promise.all(
    toolCalls.map(call => 
        toolRegistry.execute(call.name, call.params)
    )
);
```

### 3. Tool Timeouts

```typescript
const timeoutTool: Tool = {
    execute: async (params) => {
        const timeoutMs = params.timeout || 30000;
        
        return Promise.race([
            performOperation(params),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Tool timeout")), timeoutMs)
            )
        ]);
    }
};
```

## Security Considerations

### 1. Parameter Sanitization

```typescript
const secureTool: Tool = {
    execute: async (params) => {
        // Prevent path traversal
        const safePath = path.normalize(params.path);
        if (safePath.includes("..")) {
            throw new Error("Path traversal not allowed");
        }
        
        // Validate against whitelist
        if (!isAllowedPath(safePath)) {
            throw new Error("Access denied");
        }
        
        return performOperation(safePath);
    }
};
```

### 2. Resource Limits

```typescript
const limitedTool: Tool = {
    execute: async (params) => {
        // Limit file size
        const stats = await fs.stat(params.path);
        if (stats.size > MAX_FILE_SIZE) {
            throw new Error("File too large");
        }
        
        // Rate limiting
        if (!rateLimiter.allow(tool.name)) {
            throw new Error("Rate limit exceeded");
        }
        
        return performOperation(params);
    }
};
```

## Testing Tools

### 1. Mock Tools for Testing

```typescript
const mockTool: Tool = {
    name: "mock_file_reader",
    execute: async (params) => {
        // Return predictable test data
        return {
            content: `Mock content for ${params.path}`,
            size: 100
        };
    }
};

// In tests
const testRegistry = new ToolRegistry();
testRegistry.register(mockTool);
```

### 2. Tool Testing Utilities

```typescript
class ToolTester {
    static async testTool(tool: Tool, testCases: TestCase[]): Promise<TestResults> {
        const results = [];
        
        for (const testCase of testCases) {
            try {
                const result = await tool.execute(testCase.input);
                results.push({
                    passed: deepEqual(result, testCase.expected),
                    testCase
                });
            } catch (error) {
                results.push({
                    passed: testCase.shouldThrow,
                    error,
                    testCase
                });
            }
        }
        
        return results;
    }
}
```

## Best Practices Summary

1. **Tool Design**:
   - Clear, single-purpose tools
   - Comprehensive parameter validation
   - Structured return values
   - Helpful error messages

2. **Registry Management**:
   - Register tools appropriately per agent
   - Use priorities for tool selection
   - Clean up unused tools

3. **Security**:
   - Always validate and sanitize inputs
   - Implement resource limits
   - Use allowlists for sensitive operations

4. **Performance**:
   - Cache expensive operations
   - Execute independent tools in parallel
   - Implement timeouts

5. **Testing**:
   - Create mock tools for testing
   - Test edge cases and error conditions
   - Verify tool composition works correctly

This specification provides a comprehensive understanding of the TENEX Tool System, enabling developers and AI agents to effectively create, manage, and use tools within the system.