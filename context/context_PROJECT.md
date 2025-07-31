# TENEX Project Specification

## Project Overview
TENEX is a decentralized, multi-agent AI system designed for real-time collaborative software development. It focuses on managing context rather than just presenting code, leveraging the Nostr protocol for event-driven communication.

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

## Architecture
- Recently transitioned to a **phase-based workflow** encompassing the stages: CHAT, PLAN, EXECUTE, VERIFICATION, CHORES, and REFLECTION.

## Client Platforms
- The system has multiple client interfaces including:
  - Command-Line Interface (CLI)
  - Web Application (built with React)
  - iOS Application

## Agent Architecture
- **Orchestrator**: Functions as a router without user interaction, delegating tasks to specialized agents.
- **Planner**: Responsible for creating project plans and strategies.
- **Executor**: The only agent capable of file modifications and executing commands.
- **Project Manager**: Oversees project knowledge and ensures semantic understanding.
- Various **domain expert agents** that provide advisory support but cannot execute changes.

## Control Flow and Tools
- The control flow utilizes `continue()` (for orchestrator) and `complete()` (for all other agents) tools.
- Implemented review cycles to ensure adherence to quality and functionality standards.
- Follows a structured, phase-driven progression with tailored objectives for each phase.

## Current Project Status
- Operating on the **master branch**.
- One modified file: `backend/src/event-handler/reply.ts`.
- Current working directory: `/Users/pablofernandez/projects/TENEX-kf5rtr`.