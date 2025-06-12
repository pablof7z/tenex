#!/bin/bash

# TENEX iOS Test Script

set -e

echo "🧪 Running TENEX iOS Tests..."

# Run unit tests
echo "📋 Running unit tests..."
xcodebuild test \
    -project TENEXiOS.xcodeproj \
    -scheme TENEXiOS \
    -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
    -only-testing:TENEXiOSTests \
    | xcpretty

# Run UI tests
echo "🖥️ Running UI tests..."
xcodebuild test \
    -project TENEXiOS.xcodeproj \
    -scheme TENEXiOS \
    -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
    -only-testing:TENEXiOSUITests \
    | xcpretty

echo "✅ All tests passed!"

# Run Maestro tests if available
if command -v maestro &> /dev/null; then
    echo "🎭 Running Maestro E2E tests..."
    maestro test .maestro/flows/smoke-test.yaml
else
    echo "⚠️ Maestro not installed. Skipping E2E tests."
    echo "Install with: curl -Ls 'https://get.maestro.mobile.dev' | bash"
fi