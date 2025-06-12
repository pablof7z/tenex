// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TENEXiOS",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "TENEXiOS",
            targets: ["TENEXiOS"])
    ],
    dependencies: [
        .package(url: "https://github.com/pablof7z/NDKSwift.git", branch: "master"),
        .package(url: "https://github.com/kean/Nuke.git", from: "12.0.0")
    ],
    targets: [
        .target(
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
