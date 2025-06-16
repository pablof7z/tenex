#!/bin/bash

# TENEX E2E Test Runner (Project Root)
# Run this from the TENEX project root directory

set -e

echo "🧪 TENEX End-to-End Test Suite"
echo "=============================="
echo ""

# Check if we're in the project root
if [ ! -d "tenex" ] || [ ! -d "cli-client" ]; then
    echo "❌ Error: This script must be run from the TENEX project root directory"
    echo "   Current directory: $(pwd)"
    exit 1
fi

# Build cli-client first
echo "📦 Building cli-client..."
cd cli-client
bun install
bun run build
cd ..

# Run the e2e tests
echo ""
echo "🚀 Running E2E tests..."
cd tenex
./tests/e2e/run-e2e-tests.sh

echo ""
echo "✅ All tests completed!"