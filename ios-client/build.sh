#!/bin/bash

# TENEX iOS Build Script

set -e

echo "🏗️ Building TENEX iOS..."

# Clean build folder
echo "🧹 Cleaning build folder..."
xcodebuild clean -project TENEXiOS.xcodeproj -scheme TENEXiOS

# Build for iOS Simulator
echo "📱 Building for iOS Simulator..."
xcodebuild build \
    -project TENEXiOS.xcodeproj \
    -scheme TENEXiOS \
    -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
    -configuration Debug \
    ONLY_ACTIVE_ARCH=NO \
    | xcpretty

echo "✅ Build completed successfully!"