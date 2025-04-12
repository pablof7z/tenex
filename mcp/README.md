# MCP-NOSTR: Nostr augmentation of agents via Model Context Protocol

A bridge between the Model Context Protocol (MCP) and Nostr, enabling AI language models to leverage nostr for discovery, augmentation, reporting, money and more.

## Value Prop

### Code Snippets: Improve code quality
Code snippets provide WoT-weighted access to code snippets that show LLMs how to di a *specific* task in the right way. This can take generic, non-performant vibecode into perform well.

Whenever you notice an LLM makes a mistake, fix it manually, and publish a code snippet that teaches the LLM to do the thing in a certain way. Write code snippets in LLM-friendly ways.

### Agent interaction
Long running tasks merit their own nostr identities.

For example, if you have a complex task to accomplish over many days, you can tell the agent to create a nostr pubkey, give it a username, perhaps give it money (with the `deposit` command) if it might need to buy things.


> We need to refactor this piece of code, create a new pubkey for yourself, your name will be "Refactoring Agent", and give me a QR code to deposit 1000 sats in your wallet. Tell me your npub so I can follow you on nostr.

Let the agent run, give it some money...

You can instruct the agent to publish frequent updates to nostr and to wait for feedback from you and from some people you choose. Names are resolved via your own WoT.

> Now let's refactor <x>, whenever you have a significant update, publish it on nostr and wait for my feedback before proceeding. Gigi is helping me with this so if he gives you feedback also pay attention to it.

## Features

- Implements the Model Context Protocol for interacting with AI language models
- Provides CLI commands for managing Nostr identities, profiles, and content
- Publishes AI-generated content to the Nostr network
- Supports Web of Trust (WoT) for verified connections
- Manages user profiles and follows

## Installation

```bash
bunx mcp-code mcp
```

### From source

```bash
# Clone the repository
git clone https://github.com/pablof7z/mcp-code.git
cd mcp-code

# Install dependencies
bun install

# Build the executable
bun run build
```

## Usage

### Setup

For the initial setup run
```bash
./mcp-code setup
```

### As an MCP Server

Run without arguments to start the MCP server mode, which listens for MCP protocol messages on stdin and responds on stdout:

```bash
./mcp-code mcp
```

### CLI Commands

The tool also provides various command-line utilities for managing Nostr profiles and content:

```bash
# See available commands
./mcp-code --help
```

## Configuration

Configuration is stored in `~/.mcp-nostr.json`:



## Development

```bash
# Run linting
bun run lint

# Format code
bun run format

# Check and fix issues
bun run check
```

## License

MIT
