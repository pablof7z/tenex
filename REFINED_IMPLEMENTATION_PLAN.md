# Refined Agent-Based Routing Implementation Plan

Based on Gemini's architectural review, here's the refined implementation plan with improvements.

## Key Improvements from Review

### 1. Built-in Agent Key Management
Built-in agents will have their nsec stored in agents.json just like all other agents. No special handling needed.

### 2. Metadata Type Safety with Zod

```typescript
// continue.ts
const ContinueArgsSchema = z.object({
  phase: z.enum(ALL_PHASES as [Phase, ...Phase[]]).optional(),
  destination: z.string().min(1),
  reason: z.string(),
  message: z.string().min(1)
});

// complete.ts  
const CompleteArgsSchema = z.object({
  response: z.string().optional() // Made optional per feedback
});
```


## Implementation Steps (Refined)

### Phase 1: Core Infrastructure

1. **Create Built-in Agent System**
   ```typescript
   // /tenex/src/agents/builtInAgents.ts
   export interface BuiltInAgentDefinition {
     name: string;
     slug: string;
     role: string;
     instructions: string;
     tools: string[];
   }
   
   export const EXECUTER_AGENT: BuiltInAgentDefinition = {
     name: "Code Executor",
     slug: "executer",
     role: "Code Implementation Specialist",
     instructions: `You are a code execution specialist. 
     
     CRITICAL: The 'message' parameter in your context contains your primary directive from the PM.
     This is what you must accomplish.
     
     Your role is to:
     - Execute the implementation task described in the message using claude_code
     - Focus on delivering working code that fulfills the PM's request
     - When complete, use the 'complete' tool to return control to the PM
     - Include a brief summary of what you accomplished (or leave empty if obvious)`,
     tools: ["claude_code", "complete"]
   };
   ```

2. **Update Agent Types**
   ```typescript
   interface Agent {
     // ... existing fields ...
     isBuiltIn?: boolean;
   }
   ```

3. **Update PM Tool Access**
   ```typescript
   // In constants.ts
   export function getDefaultToolsForAgent(isPMAgent: boolean, phase?: string): string[] {
       if (isPMAgent) {
           return [
               readFileTool.name,
               analyze.name,
               continueTool.name,  // replaces switchPhase + handoff
               generateInventoryTool.name,
               learnTool.name,
               completeTool.name
           ];
       }
       // Non-PM agents keep existing defaults
       return [...DEFAULT_AGENT_TOOLS];
   }
   ```

4. **Enhanced AgentRegistry**
   ```typescript
   private async ensureBuiltInAgents(): Promise<void> {
     const builtInAgents = getBuiltInAgents();
     for (const def of builtInAgents) {
       // Use ensureAgent just like any other agent
       await this.ensureAgent(def.slug, {
         name: def.name,
         role: def.role,
         instructions: def.instructions,
         tools: def.tools,
         llmConfig: DEFAULT_AGENT_LLM_CONFIG
       });
       
       // Mark as built-in after creation
       const agent = this.agents.get(def.slug);
       if (agent) {
         agent.isBuiltIn = true;
       }
     }
   }
   ```

### Phase 2: New Tools with Type Safety

4. **Continue Tool with Validation**
   ```typescript
   export const continueTool: Tool = {
     name: "continue",
     description: "Route conversation to next phase/agent (PM only)",
     parameters: [
       {
         name: "phase",
         type: "string",
         description: "New phase (optional)",
         required: false,
         enum: ALL_PHASES as string[]
       },
       {
         name: "destination",
         type: "string", 
         description: "Agent slug or 'user'",
         required: true
       },
       {
         name: "reason",
         type: "string",
         description: "Routing rationale",
         required: true
       },
       {
         name: "message",
         type: "string",
         description: "Context/instructions for destination",
         required: true
       }
     ],
     
     async execute(params, context): Promise<ToolResult> {
       // Validate PM-only
       if (!context.agent?.isPMAgent) {
         return { success: false, error: "Only PM can use continue" };
       }
       
       const parseResult = parseToolParams(ContinueArgsSchema, params);
       if (!parseResult.success) return parseResult.errorResult;
       
       // Find destination agent
       const projectContext = getProjectContext();
       const targetAgent = params.destination === 'user' 
         ? null 
         : projectContext.agents.get(params.destination);
         
       if (params.destination !== 'user' && !targetAgent) {
         return { 
           success: false, 
           error: `Agent '${params.destination}' not found` 
         };
       }
       
       const metadata: ContinueMetadata = {
         routingDecision: {
           phase: params.phase,
           destination: targetAgent?.pubkey || 'user',
           destinationName: targetAgent?.name || 'user',
           reason: params.reason,
           message: params.message
         }
       };
       
       return { success: true, metadata };
     }
   };
   ```

5. **Complete Tool with PM Detection**
   ```typescript
   export const completeTool: Tool = {
     name: "complete",
     description: "Signal task completion and return control",
     parameters: [
       {
         name: "response",
         type: "string",
         description: "Summary of accomplishments (optional)",
         required: false
       }
     ],
     
     async execute(params, context): Promise<ToolResult> {
       const parseResult = parseToolParams(CompleteArgsSchema, params);
       if (!parseResult.success) return parseResult.errorResult;
       
       // Determine who to notify
       let nextAgent: string;
       if (context.agent?.isPMAgent) {
         // PM completes to user
         nextAgent = 'user';
       } else {
         // Specialists complete to PM
         const projectContext = getProjectContext();
         const pmAgent = projectContext.getProjectAgent();
         nextAgent = pmAgent.pubkey;
       }
       
       const metadata: CompleteMetadata = {
         completion: {
           response: params.response || '',
           nextAgent
         }
       };
       
       return { success: true, metadata };
     }
   };
   ```

### Phase 3: PM Prompt Updates

6. **Enhanced PM Routing Instructions**
   ```typescript
   // pm-routing.ts updates
   const PM_ROUTING_WITH_SPECIALISTS = `
   ## Routing with the Continue Tool
   
   You now have access to specialized agents for specific tasks:
   
   ### @executer - Code Implementation
   - Use when: You need to implement code, fix bugs, or make changes
   - The executer will use claude_code to complete the implementation
   - Provide clear instructions in the 'message' parameter
   
   ### @planner - Task Planning  
   - Use when: Complex tasks need architectural planning before implementation
   - The planner will create detailed plans using claude_code in plan mode
   - After receiving a plan, typically route to @executer for implementation
   
   ### Simple Tasks
   - For analysis and understanding tasks, use the 'analyze' tool
   - All implementation tasks should be delegated to @executer
   - All planning tasks should be delegated to @planner
   
   ### State Tracking
   - After a specialist completes, decide the logical next step
   - Avoid loops: Don't send the same type of request to the same specialist
   - Typical flow: User → You → @planner → You → @executer → You → User
   `;
   ```

### Phase 4: Integration & Cleanup

7. **Update AgentExecutor**
   - Replace dual metadata handling with unified ContinueMetadata
   - Handle CompleteMetadata for proper event publishing
   - Ensure p-tags are set correctly based on complete tool usage

8. **Remove Legacy Code**
   - Delete switch_phase.ts and handoff.ts
   - Remove PhaseTransitionMetadata and HandoffMetadata types
   - Clean up unused imports

## Testing Strategy

1. **Unit Tests**
   - Continue tool PM-only validation
   - Complete tool next agent logic
   - Built-in agent availability checks
   - Built-in agent creation and persistence

2. **Integration Tests**
   - Full flow: User → PM → Planner → PM → Executer → PM → User
   - Edge cases: PM handling simple tasks directly
   - Error cases: Invalid agent destinations

3. **Prompt Engineering Tests**
   - Ensure PM doesn't over-delegate simple tasks
   - Verify state tracking prevents loops
   - Test clear context passing in messages

## Risk Mitigation

1. **Context Loss**: The 'message' parameter is critical. PM prompts must emphasize comprehensive context.
2. **Agent Loops**: PM prompt must track state and avoid re-delegating same tasks.

## Breaking Changes (Acceptable)

This is a CLEAN refactor with no backwards compatibility:

1. **Existing conversations will break** - Old metadata formats won't be recognized
2. **Legacy tools deleted** - switch_phase and handoff will be gone
3. **Event metadata changes** - New ContinueMetadata and CompleteMetadata formats only
4. **No migrations** - Fresh start, existing conversations can be abandoned
5. **No compatibility layers** - Clean code only, no legacy support

This is intentional - we want a clean, maintainable codebase without legacy cruft.