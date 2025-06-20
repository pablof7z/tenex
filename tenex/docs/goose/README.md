# Goose Tool Integration

## Overview

The Goose tool provides TENEX agents with access to Goose AI's capabilities for browser automation, complex workflows, and multi-system integration through MCP (Model Context Protocol).

## Implementation

The Goose tool is implemented as a standard TENEX tool that any agent can use. It follows the same pattern as other tools like `claude_code` or `shell`.

### Location
- Implementation: `src/utils/agents/tools/goose.ts`
- Tests: `src/utils/agents/tools/goose.test.ts`
- Registration: `src/utils/agents/tools/ToolManager.ts`

## Usage

Agents can use the Goose tool for tasks such as:
- Browser automation and testing
- Taking screenshots
- Multi-step workflows
- API integration testing
- Visual regression testing

### Simple Task Example
```typescript
const result = await tools.goose({
    task: "Take a screenshot of the homepage and check if the login button is visible"
});
```

### Recipe Configuration Example
```typescript
const result = await tools.goose({
    task: "Test the checkout flow",
    recipe: {
        instructions: "Navigate through the entire checkout process and verify each step",
        extensions: ["puppeteer", "screenshot"]
    }
});
```

## Prerequisites

- Goose must be installed on the system (`goose` command available in PATH)
- MCP servers should be configured as needed (puppeteer, selenium, etc.)

## Design Principles

Following YAGNI/DRY/KISS principles:
- Simple subprocess execution with spawn
- Minimal abstraction - just what's needed
- Clear error messages
- Proper timeout handling (5 minutes)
- Progress streaming support

## Future Enhancements

Based on usage patterns, potential enhancements could include:
- Session management for multi-turn interactions
- Cost tracking and limits
- Specific MCP server configurations
- Advanced error recovery

For now, the implementation remains simple and focused on core functionality.