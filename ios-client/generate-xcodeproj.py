#!/usr/bin/env python3

import os
import subprocess
import json

# Generate a simple Xcode project using Swift Package Manager
def generate_xcode_project():
    print("🔨 Generating Xcode project for TENEX iOS...")
    
    # First, let's create an executable product in Package.swift for the app
    package_swift = """// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TENEXiOS",
    platforms: [.iOS(.v16)],
    products: [
        .executable(name: "TENEXiOS", targets: ["TENEXiOS"])
    ],
    dependencies: [
        .package(url: "https://github.com/pablof7z/NDKSwift.git", branch: "master"),
        .package(url: "https://github.com/kean/Nuke.git", from: "12.0.0")
    ],
    targets: [
        .executableTarget(
            name: "TENEXiOS",
            dependencies: [
                "NDKSwift",
                "Nuke",
                .product(name: "NukeUI", package: "Nuke")
            ],
            path: "Sources/TENEXiOS"
        ),
        .testTarget(
            name: "TENEXiOSTests",
            dependencies: ["TENEXiOS"],
            path: "Tests/TENEXiOSTests"
        )
    ]
)
"""
    
    # Write the updated Package.swift
    with open("Package.swift", "w") as f:
        f.write(package_swift)
    
    # Create main.swift to make it an executable
    os.makedirs("Sources/TENEXiOS", exist_ok=True)
    
    main_swift = """import SwiftUI

@main
struct TENEXiOSApp: App {
    var body: some Scene {
        WindowGroup {
            Text("TENEX iOS")
        }
    }
}
"""
    
    with open("Sources/TENEXiOS/main.swift", "w") as f:
        f.write(main_swift)
    
    # Generate Xcode project
    print("📦 Running swift package generate-xcodeproj...")
    result = subprocess.run(["swift", "package", "generate-xcodeproj"], capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Xcode project generated successfully!")
        print("📂 Opening in Xcode...")
        subprocess.run(["open", "TENEXiOS.xcodeproj"])
    else:
        print(f"❌ Error generating project: {result.stderr}")

if __name__ == "__main__":
    generate_xcode_project()