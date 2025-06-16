#!/bin/bash

echo "🚀 Running TENEX E2E Test: Project Creation and Startup"
echo "=================================================="
echo ""

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Run the test
bun run create-project.ts

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ E2E test passed!"
else
    echo ""
    echo "❌ E2E test failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE