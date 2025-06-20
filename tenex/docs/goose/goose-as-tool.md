# Goose as a Tool in TENEX

## Overview

This approach implements Goose as a tool in TENEX's tool registry, similar to existing tools like `claude_code`, `read_specs`, or `update_spec`. Any TENEX agent can invoke the `goose` tool when they need to perform complex tasks that benefit from Goose's capabilities, particularly browser automation, multi-step workflows, or integration with external services via MCP. This represents the lightest integration approach, treating Goose as a utility rather than a core component.

## Implementation Details

### Tool Architecture

```
TENEX Tool Registry
├── Native Tools
│   ├── claude_code
│   ├── read_specs
│   ├── update_spec
│   ├── remember_lesson
│   └── goose (new)
├── File System Tools
├── Git Tools
└── Communication Tools
```

### Core Implementation

#### 1. Goose Tool Definition (`tenex/src/utils/agents/tools/goose.ts`)

```typescript
import { spawn } from 'child_process';
import { Tool, ToolResult } from '../types';
import { NDKEvent } from '@nostr-dev-kit/ndk';

interface GooseParams {
  task: string;
  description?: string;
  allowedTools?: string[];
  constraints?: {
    timeout?: number;
    maxCost?: number;
    requireConfirmation?: boolean;
  };
  mcpServers?: string[];
  outputFormat?: 'text' | 'json' | 'structured';
  sessionId?: string; // For conversation continuity
}

export const goose: Tool = {
  name: 'goose',
  description: 'Execute complex tasks using Goose AI agent with access to browser automation and external tools via MCP',
  
  parameters: {
    task: {
      type: 'string',
      description: 'The task for Goose to perform',
      required: true
    },
    description: {
      type: 'string',
      description: 'Additional context or requirements for the task'
    },
    allowedTools: {
      type: 'array',
      description: 'MCP servers/tools Goose can use',
      items: { type: 'string' }
    },
    constraints: {
      type: 'object',
      description: 'Execution constraints'
    },
    mcpServers: {
      type: 'array',
      description: 'Specific MCP servers to enable',
      default: ['puppeteer', 'filesystem', 'shell']
    },
    outputFormat: {
      type: 'string',
      enum: ['text', 'json', 'structured'],
      default: 'structured'
    },
    sessionId: {
      type: 'string',
      description: 'Continue existing Goose session'
    }
  },
  
  async execute(params: GooseParams, context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    
    try {
      // Create inline recipe for the task
      const recipe = this.createRecipe(params, context);
      
      // Prepare Goose execution
      const gooseArgs = this.buildGooseArgs(recipe, params);
      
      // Execute Goose
      const result = await this.runGoose(gooseArgs, params, context);
      
      // Process and structure output
      const processedResult = this.processResult(result, params);
      
      // Track usage and costs
      await this.trackUsage(context, result, startTime);
      
      // Learn from execution
      if (result.errors?.length > 0) {
        await this.recordLessons(context, result);
      }
      
      return {
        success: processedResult.success,
        data: processedResult.data,
        metadata: {
          duration: Date.now() - startTime,
          cost: result.cost,
          toolsUsed: result.toolsUsed,
          sessionId: result.sessionId
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: this.getSuggestion(error)
      };
    }
  },
  
  private createRecipe(params: GooseParams, context: ToolContext) {
    return {
      version: '1.0.0',
      title: `TENEX Task: ${params.task.slice(0, 50)}`,
      description: params.description || params.task,
      instructions: this.buildInstructions(params, context),
      extensions: params.mcpServers?.map(s => `mcp://${s}`) || [],
      settings: {
        model: context.preferredModel || 'gpt-4',
        provider: context.preferredProvider || 'openai'
      }
    };
  },
  
  private buildInstructions(params: GooseParams, context: ToolContext): string {
    return `You are executing a task for a TENEX agent.

Task: ${params.task}

${params.description ? `Additional Context: ${params.description}` : ''}

Context about the requesting agent:
- Role: ${context.agent.role}
- Current Project: ${context.projectId}
- Conversation ID: ${context.conversationId}

Constraints:
${params.constraints?.timeout ? `- Complete within ${params.constraints.timeout}ms` : ''}
${params.constraints?.maxCost ? `- Stay under $${params.constraints.maxCost} in API costs` : ''}
${params.constraints?.requireConfirmation ? '- Ask for confirmation before destructive actions' : ''}

${params.allowedTools ? `You may only use these tools: ${params.allowedTools.join(', ')}` : ''}

Provide structured output that includes:
1. What actions were taken
2. What results were achieved
3. Any errors or issues encountered
4. Suggestions for follow-up actions`;
  },
  
  private async runGoose(args: string[], params: GooseParams, context: ToolContext): Promise<GooseResult> {
    return new Promise((resolve, reject) => {
      const gooseProcess = spawn('goose', args, {
        env: {
          ...process.env,
          GOOSE_OUTPUT_FORMAT: params.outputFormat,
          TENEX_CONTEXT: JSON.stringify(context)
        }
      });
      
      let output = '';
      let errorOutput = '';
      
      gooseProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Stream progress to Nostr
        this.publishProgress(context, data.toString());
      });
      
      gooseProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      gooseProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(this.parseGooseOutput(output));
        } else {
          reject(new Error(`Goose failed with code ${code}: ${errorOutput}`));
        }
      });
      
      // Handle timeout
      if (params.constraints?.timeout) {
        setTimeout(() => {
          gooseProcess.kill('SIGTERM');
          reject(new Error('Goose execution timed out'));
        }, params.constraints.timeout);
      }
    });
  }
};
```

#### 2. Tool Wrapper Utilities (`tenex/src/utils/agents/tools/goose-utils.ts`)

```typescript
export class GooseToolUtils {
  static async executeWithRetry(params: GooseParams, context: ToolContext, maxRetries = 3): Promise<ToolResult> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await goose.execute(params, context);
      } catch (error) {
        lastError = error;
        
        if (this.isRetriableError(error) && attempt < maxRetries) {
          await this.delay(attempt * 1000);
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }
  
  static createBrowserTestTask(url: string, steps: TestStep[]): GooseParams {
    return {
      task: `Test web application at ${url}`,
      description: 'Perform browser-based testing with screenshots',
      mcpServers: ['puppeteer'],
      allowedTools: ['screenshot', 'click', 'type', 'navigate'],
      constraints: {
        timeout: 300000, // 5 minutes
        requireConfirmation: false
      },
      outputFormat: 'structured'
    };
  }
  
  static createAPIWorkflowTask(workflow: APIWorkflow): GooseParams {
    return {
      task: 'Execute API workflow',
      description: JSON.stringify(workflow),
      mcpServers: ['rest-api', 'graphql'],
      allowedTools: ['http_request', 'parse_response', 'validate_schema'],
      outputFormat: 'json'
    };
  }
}
```

#### 3. Integration Examples

##### Example 1: Code Agent Using Goose for Testing

```typescript
// In code agent implementation
async function testGeneratedCode(code: string, context: AgentContext) {
  const testTask = {
    task: 'Test the React component I just created',
    description: `Component code: ${code.slice(0, 500)}... 
                  Please render it in a browser, test interactions, and take screenshots`,
    mcpServers: ['puppeteer'],
    constraints: {
      timeout: 120000
    }
  };
  
  const result = await context.tools.goose.execute(testTask, context);
  
  if (!result.success) {
    await context.tools.remember_lesson.execute({
      lesson: `Component testing failed: ${result.error}`,
      context: 'browser_testing'
    });
  }
  
  return result;
}
```

##### Example 2: Planner Agent Using Goose for Research

```typescript
// In planner agent
async function researchTechnology(tech: string, context: AgentContext) {
  const researchTask = {
    task: `Research current best practices for ${tech}`,
    description: 'Browse documentation, check recent tutorials, summarize findings',
    mcpServers: ['puppeteer', 'web-search'],
    constraints: {
      maxCost: 0.50, // Limit API costs
      timeout: 180000
    },
    outputFormat: 'structured'
  };
  
  const research = await context.tools.goose.execute(researchTask, context);
  
  // Use findings to inform planning
  return this.incorporateResearch(research.data);
}
```

#### 4. Session Management (`tenex/src/utils/agents/tools/goose-sessions.ts`)

```typescript
export class GooseSessionManager {
  private static sessions: Map<string, GooseSession> = new Map();
  
  static async continueSession(sessionId: string, newTask: string): Promise<ToolResult> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const params: GooseParams = {
      task: newTask,
      sessionId: sessionId,
      // Inherit settings from original session
      mcpServers: session.mcpServers,
      constraints: session.constraints
    };
    
    return await goose.execute(params, session.context);
  }
  
  static async createSession(initialTask: GooseParams, context: ToolContext): Promise<string> {
    const sessionId = generateId();
    
    this.sessions.set(sessionId, {
      id: sessionId,
      context,
      mcpServers: initialTask.mcpServers,
      constraints: initialTask.constraints,
      startTime: Date.now(),
      tasks: [initialTask.task]
    });
    
    // Clean up old sessions
    this.cleanupSessions();
    
    return sessionId;
  }
}
```

### Usage Patterns

#### 1. Simple One-off Tasks

```typescript
// Agent needs to quickly test something
const result = await tools.goose({
  task: "Take a screenshot of example.com and check if it has a login button"
});
```

#### 2. Complex Multi-step Workflows

```typescript
// Agent needs to perform complex integration
const workflow = await tools.goose({
  task: "Set up GitHub repository with CI/CD",
  description: `
    1. Create new repo named 'my-project'
    2. Add GitHub Actions workflow for Node.js
    3. Configure branch protection rules
    4. Set up deployment to Vercel
  `,
  mcpServers: ['github', 'vercel'],
  constraints: {
    requireConfirmation: true // For safety
  }
});
```

#### 3. Continuous Sessions

```typescript
// Start a session for ongoing work
const sessionId = await GooseSessionManager.createSession({
  task: "Help me debug this web application",
  mcpServers: ['puppeteer', 'devtools']
}, context);

// Continue in same session
const result = await GooseSessionManager.continueSession(
  sessionId,
  "Now check the network tab for failed requests"
);
```

## Benefits

### 1. Minimal Integration Complexity
- **Simple Implementation**: Just another tool in the registry
- **No Architecture Changes**: Fits existing tool pattern
- **Easy to Test**: Can test in isolation
- **Quick to Deploy**: Can be added incrementally

### 2. Universal Availability
- **Any Agent Can Use**: All agents gain Goose capabilities
- **On-Demand Usage**: Only invoked when needed
- **Context Aware**: Receives full agent context
- **Tool Composability**: Can be combined with other tools

### 3. Flexibility
- **Task Agnostic**: Can handle any Goose-appropriate task
- **Dynamic Configuration**: Parameters per invocation
- **MCP Ecosystem**: Access to all MCP servers
- **Progressive Enhancement**: Start simple, add features

### 4. Cost Efficiency
- **Pay Per Use**: Only runs when invoked
- **Resource Limits**: Can set per-task constraints
- **Shared Infrastructure**: One Goose installation
- **Optimal Model Selection**: Can choose model per task

## Pros and Cons

### Pros
1. **Simplicity**: Easiest approach to implement and understand
2. **Low Risk**: Minimal changes to existing system
3. **Immediate Value**: Can start using right away
4. **Flexibility**: Agents choose when to use Goose
5. **Cost Control**: Fine-grained usage tracking
6. **Easy Rollback**: Can remove without impact
7. **Natural Fit**: Follows established tool patterns

### Cons
1. **Limited Integration**: Misses deeper synergies
2. **Session Management**: Complex for multi-turn interactions
3. **Performance Overhead**: Process spawn per invocation
4. **Context Limitations**: Hard to maintain conversation state
5. **Learning Integration**: Harder to capture patterns
6. **Debugging Complexity**: Stack traces cross boundaries
7. **Feature Limitations**: Can't leverage all Goose capabilities

## Risks

### 1. Resource Exhaustion
**Description**: Uncontrolled Goose invocations could consume excessive resources.

**Mitigation Strategies**:
- Rate limiting per agent
- Resource quotas and monitoring
- Timeout enforcement
- Cost tracking and alerts
- Queuing system for heavy tasks

### 2. Security Vulnerabilities
**Description**: Goose tool could be exploited to access unauthorized resources.

**Mitigation Strategies**:
- Sanitize all inputs
- Restrict available MCP servers
- Audit logging of all invocations
- Principle of least privilege
- Regular security reviews

### 3. State Management Complexity
**Description**: Maintaining context across Goose invocations is challenging.

**Mitigation Strategies**:
- Session management system
- Context serialization
- Conversation caching
- Clear session lifecycle
- Automatic cleanup

### 4. Error Propagation
**Description**: Errors in Goose execution may be hard to debug from TENEX.

**Mitigation Strategies**:
- Comprehensive error wrapping
- Correlation IDs
- Debug mode with verbose output
- Error categorization
- Retry strategies

### 5. Version Drift
**Description**: Goose updates might break tool integration.

**Mitigation Strategies**:
- Version pinning
- Integration tests
- Compatibility layer
- Graceful degradation
- Update notifications

## Implementation Roadmap

### Phase 1: Basic Tool (3-5 days)
1. Implement basic goose tool
2. Add to tool registry
3. Simple task execution
4. Basic error handling
5. Initial testing

### Phase 2: Enhanced Features (1 week)
1. Session management
2. Progress streaming
3. Cost tracking
4. Structured output parsing
5. Tool presets

### Phase 3: Production Ready (1 week)
1. Comprehensive error handling
2. Resource management
3. Security hardening
4. Performance optimization
5. Documentation

### Phase 4: Advanced Features (2 weeks)
1. Conversation continuity
2. Learning integration
3. Custom MCP servers
4. Advanced workflows
5. Tool composition

## Usage Examples

### Example 1: Visual Regression Test
```typescript
await tools.goose({
  task: "Compare current homepage with yesterday's version",
  description: "Take screenshots and highlight differences",
  mcpServers: ['puppeteer', 'visual-diff'],
  constraints: { timeout: 60000 }
});
```

### Example 2: API Integration Test
```typescript
await tools.goose({
  task: "Test our API endpoints with various payloads",
  description: "Use the Postman collection in /tests/api/",
  mcpServers: ['rest-api', 'filesystem'],
  outputFormat: 'json'
});
```

### Example 3: Deployment Automation
```typescript
await tools.goose({
  task: "Deploy the application to staging",
  description: "Build, test, and deploy using our CI/CD pipeline",
  mcpServers: ['github', 'vercel'],
  constraints: { 
    requireConfirmation: true,
    maxCost: 5.00 
  }
});
```

## Cost Analysis

### Development Investment
- **Initial Implementation**: 1 week (1 engineer)
- **Testing & Refinement**: 3-5 days
- **Documentation**: 2-3 days
- **Total**: ~2 weeks effort

### Operational Costs
- **Goose License**: Open source (free)
- **Compute**: ~$0.001-0.10 per invocation
- **Storage**: Minimal (logs and results)
- **Maintenance**: ~2 hours/month

### ROI Calculation
- **Time Saved**: 5-10 hours/week on complex tasks
- **Quality Improvement**: Reduce bugs by 20-30%
- **Developer Satisfaction**: Less repetitive work
- **Payback Period**: 2-3 weeks

## Recommendation

Implementing Goose as a tool is the recommended starting point for TENEX integration. This approach offers:

1. **Lowest Risk**: Minimal system changes
2. **Fastest Implementation**: Can be live in days
3. **Immediate Value**: Agents gain new capabilities instantly
4. **Learning Opportunity**: Understand Goose before deeper integration
5. **Escape Hatch**: Easy to remove if not valuable

This approach is ideal for:
- Teams wanting to experiment with Goose
- Projects needing browser automation quickly
- Organizations with limited resources
- Risk-averse environments

After gaining experience with Goose as a tool, TENEX can evaluate whether deeper integration (specialized agent or execution framework) would provide additional value.

## Conclusion

Implementing Goose as a tool represents the most pragmatic path for TENEX to gain advanced automation capabilities. While it doesn't leverage the full potential of Goose's architecture, it provides immediate value with minimal risk. This approach allows TENEX to maintain its architectural vision while benefiting from Goose's powerful features. As teams gain experience with the tool, they can make informed decisions about deeper integration paths. The tool approach embodies the principle of "make it work, then make it better" – a solid foundation for iterative improvement.