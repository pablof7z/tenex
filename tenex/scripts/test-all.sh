#!/bin/bash
# Comprehensive test runner for TENEX

set -e

echo "🧪 Running TENEX Test Suite"
echo "=========================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run test category
run_tests() {
    local category=$1
    local command=$2
    
    echo -e "\n${BLUE}Running ${category}...${NC}"
    if $command; then
        echo -e "${GREEN}✓ ${category} passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${category} failed${NC}"
        return 1
    fi
}

# Track failures
FAILED=0

# Type checking
run_tests "Type Checking" "bun run typecheck" || ((FAILED++))

# Linting
run_tests "Linting" "bun run lint" || ((FAILED++))

# Unit tests
run_tests "Unit Tests" "bun test:unit" || ((FAILED++))

# Integration tests
run_tests "Integration Tests" "bun test:integration" || ((FAILED++))

# E2E tests (if they exist)
if [ -d "tests/e2e" ] && [ "$(ls -A tests/e2e/*.test.ts 2>/dev/null)" ]; then
    run_tests "E2E Tests" "bun test:e2e" || ((FAILED++))
else
    echo -e "\n${BLUE}Skipping E2E Tests (no tests found)${NC}"
fi

# Coverage report
echo -e "\n${BLUE}Generating Coverage Report...${NC}"
bun test:coverage

# Summary
echo -e "\n=========================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ ${FAILED} test suite(s) failed${NC}"
    exit 1
fi