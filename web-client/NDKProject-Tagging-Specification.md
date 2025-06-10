# NDKProject Event Tagging Specification

This document outlines how TENEX marks agents and rules in NDKProject events (kind 31933) to enable agent-specific instruction assignment.

## Overview

NDKProject events use a structured tagging system to associate AI agents with projects and assign instructions to specific agents or all agents within a project context.

## Tag Structure

### Agent Tags

Agent tags mark which AI agents are associated with a project:

```
["agent", "<agent-event-id>"]
```

- **Tag Name**: `agent`
- **Tag Value**: The NDK event ID of the agent (NDKAgent event with kind 31990)
- **Purpose**: Associates an AI agent with the project for task assignment and instruction targeting

**Example**:
```json
["agent", "abc123def456..."]
```

### Rule Tags

Rule tags assign instruction sets to agents within the project context:

#### All Agents Assignment

When an instruction applies to all agents in the project:

```
["rule", "<rule-event-id>"]
```

- **Tag Name**: `rule`
- **Tag Value**: The NDK event ID of the instruction/rule
- **Purpose**: Makes the instruction available to all agents in the project

**Example**:
```json
["rule", "instruction789abc..."]
```

#### Specific Agent Assignment

When an instruction applies to specific agents only:

```
["rule", "<rule-event-id>", "<agent-name-1>", "<agent-name-2>", "<agent-name-3>"]
```

- **Tag Name**: `rule`
- **Tag Value 1**: The NDK event ID of the instruction/rule
- **Tag Values 2+**: Agent names (from NDKAgent.name property) that should have access to this instruction
- **Purpose**: Restricts instruction availability to specific named agents

**Example**:
```json
["rule", "instruction789abc...", "code", "debugger", "architect"]
```

## Complete Example

Here's an example of a complete NDKProject event with agent and rule tags:

```json
{
  "kind": 31933,
  "pubkey": "project-pubkey...",
  "created_at": 1704067200,
  "content": "A React TypeScript project with AI-driven development",
  "tags": [
    ["d", "my-react-app"],
    ["title", "My React App"],
    ["repo", "https://github.com/user/my-react-app"],
    ["hashtags", "react", "typescript", "ai"],
    
    // Agent associations
    ["agent", "agent-event-id-1"],
    ["agent", "agent-event-id-2"], 
    ["agent", "agent-event-id-3"],
    
    // Rule assignments
    ["rule", "typescript-rules-id"],                           // Available to all agents
    ["rule", "code-review-rules-id", "code", "reviewer"],      // Only for 'code' and 'reviewer' agents
    ["rule", "debugging-rules-id", "debugger"],                // Only for 'debugger' agent
    ["rule", "architecture-rules-id", "architect", "code"]     // Only for 'architect' and 'code' agents
  ]
}
```

## Agent Name Resolution

Agent names are derived from the `NDKAgent.name` property (mapped to the "title" tag in NDKAgent events). This provides a human-readable identifier for rule assignment targeting.

## Use Cases

### 1. General Project Instructions
Instructions that apply to all agents (coding standards, project conventions):
```json
["rule", "general-coding-standards-id"]
```

### 2. Role-Specific Instructions
Instructions that apply only to agents with specific roles:
```json
["rule", "frontend-specific-rules-id", "frontend", "ui-designer"]
["rule", "backend-specific-rules-id", "backend", "api-developer"]
```

### 3. Task-Type Instructions
Instructions for specific types of work:
```json
["rule", "testing-guidelines-id", "tester", "qa"]
["rule", "deployment-rules-id", "devops", "deployment"]
```

## Implementation Notes

1. **Agent Selection First**: Users select agents before assigning instructions to ensure valid agent name references
2. **Validation**: The UI validates that agent names in rule tags correspond to selected project agents
3. **Fallback Behavior**: Instructions without agent specifications apply to all project agents
4. **Case Sensitivity**: Agent names in rule tags are case-sensitive and must match exactly

## Future Extensions

This tagging structure can be extended to support:
- Time-based rule assignments
- Conditional rule activation
- Rule priority levels
- Agent capability-based assignments

---

*This specification ensures clear, structured communication between the TENEX frontend and AI agents about which instructions apply to which agents within a project context.*