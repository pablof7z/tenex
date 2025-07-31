# TENEX Project Specification

## Project Overview
TENEX is a multi-agent AI system designed for real-time collaboration and project coordination. It operates across multiple client platforms and uses an event-driven architecture to ensure all parts of the system are synchronized.

## What TENEX IS (Confirmed by User)
- A system accessible via a command-line interface, a native iOS application, and a standard web browser.
- A multi-agent AI system capable of task coordination and execution.
- Utilizes an event-driven protocol for real-time communication.
- Includes a backend daemon that constantly monitors and publishes the project's status.

## Core Behaviors & Features (Confirmed by User)
### Real-time Status Updates
- The system publishes `PROJECT_STATUS` events (kind 24010) to provide real-time feedback on its operational state.
- These status events are published at 15-second intervals to ensure a responsive user experience.

### User Interface & Design Philosophy
- The user interface prioritizes simplicity and a clean aesthetic. For example, complex status icons are replaced with simple colored dots to reduce visual clutter.

## Key Assumptions Made
- The system's primary goal is to facilitate real-time, collaborative work.
- Responsiveness and a minimalist UI are valued more highly than information density.
- All client applications need to receive and display the same synchronized project status.

## What TENEX is NOT (Inferred Boundaries)
- Not a single-user, offline application.
- Not primarily a file management or long-term data storage system; its focus is on real-time events.
