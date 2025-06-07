# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TENEX is a context-first development environment that orchestrates AI assistants to manage software development. It's built as a Next.js application with TypeScript, React, and integrates deeply with the Nostr protocol for decentralized collaboration.

## Common Development Commands

### Development
```bash
bun run dev        # Start the Next.js development server
bun install        # Install dependencies
```

### Code Quality
```bash
bun run lint       # Run Next.js linting
biome check .      # Run Biome linting and formatting checks
biome format . --write  # Auto-format code with Biome
```

### MCP Server (in mcp/ directory)
```bash
cd mcp
bun run build      # Build the MCP server executable
bun run lint       # Lint MCP server code
bun run format     # Format MCP server code
```

### CLI (in cli/ directory)
```bash
cd cli
bun run start      # Run the TENEX CLI
```

## Architecture Overview

### Frontend Structure
- **Next.js App Router**: All pages in `app/` directory using React Server Components
- **State Management**: Zustand for client-side state (`lib/store/`)
- **UI Components**: shadcn/ui components in `components/ui/`
- **Nostr Integration**: NDK (Nostr Development Kit) for all Nostr operations

### Key Architectural Patterns

1. **Event-driven Architecture**: Built on Nostr protocol for real-time, decentralized events
   - Projects are NDKArticle events (kind 30023)
   - Tasks are NDKEvent (kind 1934)
   - All collaboration happens through Nostr events

2. **Component Organization**:
   - Event-specific components: `components/events/{note|project|task}/`
   - Page-specific components: `app/[page]/components/`
   - Shared UI components: `components/ui/`
   - User components: `components/user/`

3. **API Routes**: Next.js API routes in `app/api/` handle:
   - Project filesystem operations
   - Script execution (improve-project-spec)
   - Editor integration (VS Code opening)

4. **MCP Server**: Model Context Protocol server for AI integration
   - Publishes status updates to Nostr
   - Handles git operations
   - Located in `mcp/` directory

### Important Context Rules

The `.roo/` directory contains structured context rules that must be followed:

1. **Task Status Updates**: You MUST publish frequent status updates using `mcp__tenex-mcp__publish_task_status_update` tool, including confidence levels (1-10)

2. **NDK Usage**: 
   - Always use NDK as a singleton
   - Use `useSubscribe()` for fetching data (NOT `useEvents`)
   - Never use React Context API for NDK
   - Events are optimistically published - don't await `event.publish()`

3. **Code Style**:
   - Use Biome for formatting (4 spaces, double quotes)
   - Follow existing patterns in the codebase
   - Never add comments unless explicitly asked
   - Prefer editing existing files over creating new ones

### Key Technologies

- **Runtime**: Bun (not Node.js)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State**: Zustand
- **Protocol**: Nostr via NDK
- **Formatter/Linter**: Biome

### Development Tips

1. **File Paths**: All tools require absolute paths (not relative)
2. **Nostr Events**: Use appropriate NDK event types (NDKArticle for projects, NDKEvent for tasks)
3. **API Calls**: Use `useConfig` hook to get the backend API URL from localStorage
4. **Testing**: Check README or search codebase for test commands before assuming
5. **Git Operations**: Never commit unless explicitly asked by the user

### Project Structure Notes

- Projects are stored in `projects/` directory with `.tenex.json` config files
- Each project has its own nsec for Nostr communication
- Voice transcription features use OpenAI Whisper API
- MCP server enables AI agents to publish Nostr events and perform git operations
- Templates system in `project-templates/` for creating new projects with predefined context

When working on this codebase, always check the `.roo/rules/` directory for the latest context-specific guidelines and requirements.