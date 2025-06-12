# TENEX iOS

A native iOS client for TENEX - the context-first development environment built on Nostr protocol.

## Features

- **Authentication**: Login with nsec or generate new Nostr accounts
- **Project Management**: Create, view, and manage software projects
- **Chat Interface**: Real-time communication with AI agents and collaborators  
- **Agent Discovery**: Browse and install AI agents for your projects
- **Instructions**: Create and manage context guidelines
- **Settings**: Configure relays, backend servers, and profile

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.9+

## Dependencies

- [NDKSwift](https://github.com/pablof7z/NDKSwift) - Nostr Development Kit for Swift
- [Nuke](https://github.com/kean/Nuke) - Image loading and caching
- [SwiftUIIntrospect](https://github.com/rasmuslos/SwiftUIIntrospect) - SwiftUI introspection

## Building

1. Clone the repository
2. Open `TENEXiOS.xcodeproj` in Xcode
3. Wait for Swift Package Manager to resolve dependencies
4. Select your target device or simulator
5. Build and run (⌘R)

## Testing

### Unit Tests

Run unit tests in Xcode:
```bash
# From command line
xcodebuild test -project TENEXiOS.xcodeproj -scheme TENEXiOS -destination 'platform=iOS Simulator,name=iPhone 15'

# Or in Xcode
⌘U
```

### UI Tests

Run UI tests in Xcode:
```bash
# From command line
xcodebuild test -project TENEXiOS.xcodeproj -scheme TENEXiOSUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

### Maestro E2E Tests

1. Install Maestro:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

2. Run tests:
```bash
cd ios-client
maestro test .maestro/flows

# Or run specific flow
maestro test .maestro/flows/01-login.yaml

# Run smoke test
maestro test .maestro/flows/smoke-test.yaml
```

## Architecture

The app follows MVVM architecture with SwiftUI:

- **Models**: Data structures for Projects, Chats, Agents, etc.
- **Views**: SwiftUI views organized by feature
- **Managers**: Singleton managers for NDK, Auth, Projects, Backend
- **Services**: Keychain management, API services

## Project Structure

```
TENEXiOS/
├── Managers/          # Singleton managers
├── Models/            # Data models
├── Views/             # SwiftUI views
│   ├── Auth/         # Login/authentication
│   ├── Projects/     # Project management
│   ├── Chats/        # Chat interface
│   ├── Agents/       # Agent discovery
│   ├── Instructions/ # Instructions management
│   ├── Settings/     # App settings
│   └── Common/       # Shared components
├── Services/          # External services
└── Utils/            # Utilities
```

## Configuration

### Backend URL

The app connects to a TENEX backend server. Configure in Settings or via UserDefaults:

```swift
UserDefaults.standard.set("http://localhost:3000", forKey: "backendURL")
```

### Nostr Relays

Default relays are configured in `NDKManager.swift`. Add/remove relays in Settings.

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

See parent repository for license information.