#!/bin/bash

# Example: Running E2E tests with a specific Nostr identity

# You can provide your nsec in multiple ways:

# 1. Via command line argument
echo "Running with nsec via CLI argument..."
bun run src/cli.ts run simple-brainstorming \
  --nsec nsec1yourprivatekeyhere \
  --debug

# 2. Via environment variable
echo "Running with nsec via environment variable..."
export TENEX_E2E_NSEC=nsec1yourprivatekeyhere
bun run src/cli.ts run file-creation --debug

# 3. In your test scenario code directly
echo "You can also set nsec in your scenario code:"
echo "const orchestrator = new Orchestrator({"
echo "  nsec: 'nsec1yourprivatekeyhere',"
echo "  llmConfig: { ... }"
echo "});"

# Example with full options
echo "Running with all options..."
bun run src/cli.ts run brainstorming \
  --nsec nsec1yourprivatekeyhere \
  --provider openai \
  --model gpt-4 \
  --api-key sk-yourapikey \
  --relays wss://relay.damus.io,wss://relay.primal.net \
  --debug \
  --log-file test-run.log