#!/bin/bash

# TENEX E2E Test Runner Script
# This script runs all e2e tests for the TENEX system

set -e

echo "🧪 TENEX E2E Test Suite"
echo "======================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the tenex directory${NC}"
    exit 1
fi

# Clean up any existing test directories
echo "🧹 Cleaning up test directories..."
rm -rf test-e2e-temp test-e2e-errors

# Run the tests
echo ""
echo "🚀 Running E2E tests..."
echo ""

# Run all e2e tests
bun test tests/e2e/*.test.ts --timeout 120000

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All E2E tests passed!${NC}"
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

# Clean up after tests
echo ""
echo "🧹 Cleaning up..."
rm -rf test-e2e-temp test-e2e-errors

echo ""
echo "✨ E2E test run complete!"