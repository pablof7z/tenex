# TENEX Project Specification

## Project Overview
TENEX is a multi-agent AI system that operates across multiple platforms and clients, utilizing a Nostr-based event system for real-time communication and coordination.

## What TENEX IS (Confirmed by User)
- A system that publishes backend status events (24010/PROJECT_STATUS events)
- Uses event-driven architecture with configurable publishing frequencies
- Has multiple client implementations (CLI, web, iOS)
- Includes a backend daemon that monitors and publishes project status
- Utilizes Nostr protocol for event handling and distribution
- Has multi-agent coordination capabilities

## Architecture Components (Observed)
### Core Backend (`tenex/`)
- Event handling system with configurable intervals
- LLM integration with multiple provider support
- Agent execution framework
- Project status monitoring and publishing
- Nostr event management

### Client Applications
- **CLI Client** (`cli-client/`): Command-line interface
- **Web Client** (`web-client/`): Browser-based interface with React/TypeScript
- **iOS Client** (`tenex-ios/`): Native iOS application

### Testing Framework (`e2e-framework/`)
- End-to-end testing capabilities
- Scenario-based testing support

## Key Technical Details (Confirmed)
### Event System
- **PROJECT_STATUS Events (24010)**: Published at configurable intervals
  - Current frequency: 15 seconds (changed from 60 seconds on 2024-12-23)
  - Controlled by `STATUS_INTERVAL_MS` constant in `constants.ts`
- Event types include metadata, replies, tasks, agent requests, typing indicators

### Configuration Management
- Event publishing frequencies are centrally managed
- Constants are defined in `tenex/src/commands/run/constants.ts`
- System supports real-time configuration changes

## Recent Changes (User-Confirmed)
### 2024-12-23: Status Event Frequency Update
- Modified 24010 event publishing from 60-second to 15-second intervals
- Rationale: Provide more responsive project status updates
- Impact: 4x increase in status event frequency for better real-time feedback

## Key Assumptions Made
- The system is designed for real-time collaboration and monitoring
- Event frequency changes are made to improve user experience
- Multiple clients need synchronized project status information
- The system prioritizes responsiveness over bandwidth conservation

## Technology Stack (Observed)
- **Backend**: TypeScript/Node.js with Bun runtime
- **Web Client**: React with TypeScript, Vite build system
- **iOS Client**: Native Swift/SwiftUI
- **Protocol**: Nostr for event distribution
- **Testing**: Custom E2E framework

## What TENEX is NOT (Inferred Boundaries)
- Not a simple single-user application
- Not primarily a file management system
- Not focused on long-term data storage (appears event-driven)

---
*This specification evolves based on user interactions and system observations. Last updated: 2024-12-23*