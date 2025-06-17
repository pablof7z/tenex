# TENEX

>  Orchestrate the orchestrators.

![readme](./images/readme.png)

If LLMs represent a paradigm-shift in software development, is the text editor still the tool we use to build software?

TENEX is what a code editor might look like if we assume that code is no longer the main point of contact with the software being built, but rather, *context* is most crucial building block to manage.

The point of TENEX is that human time is sacred; whenever a human must intervine, it means the system failed. As such, we want to 

## Features

TENEX revolutionizes software development by putting context at the center of the development experience. Here's what makes it powerful:

- **🎯 Context-First Development**: Move beyond traditional code editing to a paradigm where understanding and managing context drives the development process
- **🎙️ Voice-to-Code**: Transform your ideas into actionable tasks using advanced speech-to-text transcription with intelligent parsing
- **🤖 AI-Powered Orchestration**: Leverage multiple specialized AI modes (Code, Debug, Architect, Orchestrator) that work together seamlessly
- **📝 Intelligent Task Management**: Automatically parse voice input into structured tasks with titles and descriptions
- **🔑 Project Identity**: Each project gets its own nsec (Nostr private key) for secure communication and context preservation
- **🔄 Real-time Collaboration**: Built on Nostr protocol for decentralized, real-time collaboration and updates
- **🎨 Multi-Column Interface**: Organize your work across multiple views for enhanced productivity
- **🔧 Extensible Architecture**: Plugin-based system that adapts to your workflow needs
- **📊 Smart Context Awareness**: AI assistants that understand your project structure and provide contextually relevant suggestions

Whether you're architecting complex systems, debugging intricate issues, or rapidly prototyping new features, TENEX provides the tools and intelligence to amplify your development capabilities.

## Installation

TENEX is designed to run locally on your development machine and integrates deeply with your existing workflow.

### Prerequisites
- [Bun](https://bun.sh) runtime (not Node.js)
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/pablof7z/tenex
cd tenex

# Install dependencies for all packages
bun install

# Start the web client (development mode)
cd web-client
bun run dev

# In another terminal, start the CLI daemon (optional)
cd tenex
./bin/tenex.ts daemon
```

### Components

- **Web Client**: Main UI at `http://localhost:5173`
- **CLI Tool**: Command-line interface for project management
- **MCP Server**: Model Context Protocol server for AI integration
- **Daemon**: Background service for event monitoring (optional)

### Author

[@pablof7z](https://njump.me/f7z.io)

### License

MIT