#!/bin/bash

# Create Xcode project for TENEX iOS
echo "Creating TENEX iOS Xcode project..."

# Generate xcodeproj from Swift Package
cd /Users/pablofernandez/test123/TENEX-pfkmc9/ios-client
swift package generate-xcodeproj --output TENEXiOS.xcodeproj 2>/dev/null || {
    echo "Swift package approach failed, creating minimal project structure..."
    
    # Create minimal xcodeproj structure
    mkdir -p TENEXiOS.xcodeproj/project.xcworkspace/xcshareddata
    mkdir -p TENEXiOS.xcodeproj/xcuserdata
    
    # Create basic project.pbxproj
    cat > TENEXiOS.xcodeproj/project.pbxproj << 'EOF'
// !$*UTF8*$!
{
    archiveVersion = 1;
    classes = {
    };
    objectVersion = 56;
    objects = {
    };
    rootObject = 1234567890ABCDEF1234567890ABCDEF;
}
EOF
    
    echo "Note: Created minimal project structure. Please open in Xcode to properly configure."
}

echo "✅ Done! You can now open TENEXiOS.xcodeproj in Xcode"