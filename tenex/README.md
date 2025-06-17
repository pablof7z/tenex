# TENEX CLI

Command Line Interface for TENEX - a unified tool for daemon management and project orchestration.

## Installation

```bash
cd tenex
bun install
```

## Commands

### Core Commands

- `tenex daemon` - Start the event monitoring daemon for whitelisted pubkeys
- `tenex project init <path> <naddr>` - Initialize a new project from Nostr event
- `tenex project run` - Start multi-agent orchestration system for a project
- `tenex setup` - Configure TENEX settings

### Debug Commands

- `tenex debug system-prompt [--agent <name>]` - Show the system prompt for an agent (default: "default")

## Usage

Run the CLI directly:
```bash
./bin/tenex.ts [command]
```

Or use bun:
```bash
bun run start [command]
```

## Architecture

The CLI provides a unified interface combining:
- **Daemon Mode**: Monitors Nostr events and automatically spawns project processes
- **Project Management**: Initialize and run AI agent orchestration for projects
- **Debug Tools**: Inspect agent configurations and system prompts

See `/src` for implementation details.