# TENEX Web Client

The main user interface for TENEX - a context-first development environment that orchestrates multiple AI agents.

## Features

- **Project Management**: Create and manage AI-powered software projects
- **Living Documentation**: Browse and update project specifications as Nostr events
- **Multi-Agent Orchestration**: Configure and monitor multiple AI agents
- **Voice-to-Task**: Convert spoken ideas into structured development tasks
- **Real-time Collaboration**: Live updates with typing indicators and rich text
- **Task Management**: Create, assign, and track development progress

## Tech Stack

- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State Management**: Jotai
- **Protocol**: Nostr via @nostr-dev-kit/ndk-hooks
- **Voice**: OpenAI Whisper API

## Development

### Prerequisites

- [Bun](https://bun.sh) runtime (not Node.js)
- A running TENEX backend (optional for full functionality)

### Getting Started

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# The app will be available at http://localhost:5173
```

### Available Scripts

```bash
bun run dev        # Start Vite dev server
bun run build      # Build for production
bun run preview    # Preview production build
bun run lint       # Run ESLint
bun run test       # Run tests with Vitest
```

## Project Structure

```
src/
├── components/      # React components
│   ├── ui/         # shadcn/ui components
│   ├── agents/     # Agent management
│   ├── projects/   # Project views
│   ├── tasks/      # Task management
│   └── common/     # Shared components
├── hooks/          # Custom React hooks
├── lib/            # Utilities and setup
└── utils/          # Helper functions
```

## Configuration

The app uses environment variables for configuration. Create a `.env` file:

```env
# Optional: Backend URL (defaults to http://localhost:3456)
VITE_BACKEND_URL=http://localhost:3456

# Optional: Custom Nostr relays
VITE_RELAY_URL=wss://relay.example.com
```

## Key Components

- **AgentsPage**: Manage AI agents and their configurations
- **ProjectDashboard**: Main project view with tasks and documentation
- **ChatInterface**: Real-time communication with agents
- **DocsPage**: Living documentation viewer
- **VoiceTaskDialog**: Voice-to-task conversion

## Contributing

See the main [TENEX README](../README.md) for contribution guidelines.