# TENEX MCP Server

Model Context Protocol server for TENEX that enables AI agents to publish status updates to Nostr and perform git operations.

## Version 0.5.0 - Agent Management System

This version introduces a powerful agent management system that allows multiple AI agents to have their own identities within a project.

## Features

- **Multi-Agent Support**: Each project can have multiple agents (code, planner, debugger, etc.)
- **Automatic Agent Creation**: Agents are created on-demand when first used
- **Agent Profiles**: Each agent publishes its own kind:0 profile event (e.g., "code @ ProjectName")
- **Task Status Updates**: Publish progress updates with confidence levels
- **Git Integration**: Automatic commits with task context
- **Nostr Publishing**: All updates are published to the Nostr network

## Installation

```bash
npm install -g tenex-mcp
```

## Usage

### Starting the MCP Server

```bash
# With project agents configuration (recommended)
tenex-mcp --config-file /path/to/project/.tenex/agents.json

# With deprecated nsec parameter
tenex-mcp --nsec nsec1...
```

### Agents Configuration

Projects use `.tenex/agents.json` to manage agent identities:

```json
{
  "default": "nsec1...",
  "code": "nsec1...",
  "planner": "nsec1...",
  "debugger": "nsec1..."
}
```

Agents are created automatically when first referenced in a `publish_task_status_update` call.

## MCP Tools

### publish_task_status_update

Publishes a task status update to Nostr with agent identity.

Parameters:
- `update` (string): The update to publish
- `taskId` (string): Task ID being worked on
- `confidence_level` (number): Confidence level 1-10 (10 = very confident)
- `title` (string): Short title for the update (used as git commit message)
- `agent_name` (string): Name of the agent publishing (e.g., "code", "planner")

### publish

Publishes a general note to Nostr (uses default agent).

Parameters:
- `content` (string): The content to publish

### Git Commands

- `git_reset_to_commit`: Reset repository to a specific commit
- `git_commit_details`: Get details about a specific commit
- `git_validate_commit`: Validate if a commit exists

## Environment Variables

- `NSEC`: Deprecated - use --config-file instead
- `PROJECTS_PATH`: Path to projects directory

## What's New in 0.5.0

- **Breaking Change**: Projects now use `agents.json` instead of `nostr.json`
- Added mandatory `agent_name` parameter to status updates
- Agents are created dynamically with proper nsec encoding
- Each agent has its own Nostr identity and profile
- Improved error handling and logging

## Migration from 0.4.x

If upgrading from a previous version:

1. Replace `.tenex/nostr.json` with `.tenex/agents.json`:
   ```json
   {
     "default": "your-existing-nsec"
   }
   ```

2. Update MCP server invocation to use `--config-file` instead of `--nsec`

3. Add `agent_name` parameter to all `publish_task_status_update` calls

## License

MIT