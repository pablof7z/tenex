#!/bin/bash

# Exit on any error
set -e

echo "🚀 Running LLM Status E2E Test"
echo "================================"

# Change to the e2e directory
cd "$(dirname "$0")/e2e"

# Make the test executable
chmod +x create-project-with-llm-status-validation.ts

# Run the test
echo "Starting comprehensive E2E test..."
bun run create-project-with-llm-status-validation.ts

echo "✅ E2E test completed successfully!"