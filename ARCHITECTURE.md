# Project Architecture Map

This document provides a high-level overview of the project structure, outlining the location of key definitions, components, and configurations.

## 1. Configuration (`/`)

Contains standard configuration files for Git, dependencies (Bun/PNPM), Next.js, TypeScript, Tailwind CSS, PostCSS, and component libraries.

*   `.gitignore`
*   `biome.json`
*   `bun.lock`
*   `components.json`
*   `next.config.mjs`
*   `package.json`
*   `pnpm-lock.yaml`
*   `postcss.config.mjs`
*   `tailwind.config.ts`
*   `tsconfig.json`

## 2. Application Logic (`app/`)

Contains the core application routes, pages, and global styles.

*   `app/layout.tsx`: Defines `RootLayout`, the main HTML structure for all pages.
*   `app/page.tsx`: Defines `LandingPage`, the public-facing homepage.
*   `app/globals.css`: Global styles applied to the application.
*   `app/dashboard/page.tsx`: Defines `DashboardPage`, showing a list of projects and allowing creation of new ones. Uses `AppLayout`.
*   `app/project/[id]/page.tsx`: Defines `ProjectPage`, a dynamic route displaying detailed information for a specific project (`id`). Includes tabs for Overview, Tasks, Specs, and Settings. Uses `AppLayout`, various UI components, and dialogs.
*   `app/project/[id]/[taskId]/page.tsx`: Defines `TaskDetailPage`, showing details for a specific task within a project. Uses `AppLayout`.
## 3. Reusable Components (`components/`)

Contains shared React components used throughout the application, organized in a hierarchical structure.

### 3.1 Layout Components

*   `components/app-layout.tsx`: Defines `AppLayout`, the main authenticated application layout with a sidebar and header.
*   `components/theme-provider.tsx`: Manages theme state (light/dark/system).
*   `components/theme-toggle.tsx`: Defines `ThemeToggle`, a dropdown button to switch themes.

### 3.2 Event-specific Components (`components/events/`)

Components that render specific Nostr event kinds, organized by event type:

*   `components/events/note/`: Components for rendering Nostr notes (kind 1)
    * `components/events/note/card.tsx`: Renders a single note/tweet with interaction buttons
*   `components/events/project/`: Components for rendering project events
    * `components/events/project/card.tsx`: Renders a project card with metadata

### 3.3 User Components (`components/user/`)

Components related to user profiles and interactions:

*   `components/user/avatar.tsx`: Renders a user avatar with fallback based on pubkey

### 3.4 Provider Components (`components/providers/`)

Components that provide context or services to the application:


### 3.5 UI Components (`components/ui/`)

*   `components/ui/`: Contains a large collection of UI primitive components (Button, Card, Dialog, Input, Tabs, etc.), based on shadcn/ui.

## 4. Custom Hooks (`hooks/`)

Contains custom React hooks for reusable logic.

*   `hooks/use-mobile.tsx`: Defines `useIsMobile` hook to detect mobile screen sizes.
*   `hooks/use-toast.ts`: Defines `useToast` hook and related logic for managing and displaying toast notifications.

## 5. Utilities (`lib/`)

Contains utility functions.

*   `lib/utils.ts`: Defines `cn` utility for conditional class names.
*   `lib/projectUtils.ts`: Defines `getProjectPath` and `getProjectContextPath` for resolving project file paths based on `PROJECTS_PATH` env var.
*   `lib/nostr/ndk.ts`: Initializes and configures the NDK instance.
*   `lib/nostr/events/project.ts`: Defines `NDKProject` class extending `NDKArticle` for project-specific event handling (kind 30023).
*   `lib/nostr/events/task.ts`: Defines `NDKTask` class extending `NDKEvent` for task-specific event handling (kind 1934).
## 6. Static Assets (`public/`)

Contains static files like images and logos served directly.

*   Example: `public/placeholder-logo.svg`

## 7. Styles (`styles/`)

Contains additional global styles.

*   `styles/globals.css`: Potentially overridden or supplemented by `app/globals.css`.

## 8. API Routes (`app/api/`)

Contains backend API endpoints built with Next.js API Routes.

*   `app/api/projects/create-local/route.ts`
    *   **Responsibility:** Handles `POST` requests to create a new project directory structure on the local filesystem (using `PROJECTS_PATH` env var), including the initial `context/SPEC.md` file.
    *   **Likely Called From:** `app/dashboard/page.tsx` (when creating a new project).
*   `app/api/projects/[id]/route.ts`
    *   **Responsibility:** Handles standard CRUD operations (`GET`, `PUT`, `DELETE`) for a specific project identified by `[id]`. (Exact implementation needs verification).
    *   **Likely Called From:** `app/project/[id]/page.tsx` or related components for fetching/updating/deleting project details.
*   `app/api/projects/[id]/configure/route.ts`
    *   **Responsibility:** Handles project-specific configuration updates (e.g., saving NDK nsec).
    *   **Likely Called From:** `app/project/[id]/components/ProjectSettingsTab.tsx` or similar settings UI.
*   `app/api/projects/[id]/open-editor/route.ts`
    *   **Responsibility:** Handles `POST` requests to trigger opening the specified project's directory in the user's configured editor (via the `scripts/open-editor` script).
    *   **Likely Called From:** `app/project/[id]/page.tsx` or `app/dashboard/page.tsx` (e.g., an "Open in Editor" button).
*   `app/api/projects/[id]/specs/route.ts`
    *   **Responsibility:** Handles `GET` requests to retrieve project specification files (e.g., `SPEC.md`) and `PUT` requests to update the `SPEC.md` file content.
    *   **Likely Called From:** `app/project/[id]/components/ProjectSpecsTab.tsx` (for displaying and editing the spec).
*   `app/api/run/route.ts`
    *   **Responsibility:** Executes external scripts (like `scripts/improve-project-spec`) via `bun run`, passing stdin and returning stdout. Used for AI spec improvement.
    *   **Likely Called From:** `app/project/[id]/components/ProjectSpecsTab.tsx` ("Improve with AI" button).


## 9. Scripts (`scripts/`)

Contains executable scripts for various development and operational tasks.

*   `scripts/improve-project-spec`: A Bun script that takes project details (name, tagline, spec) via stdin (JSON), prompts an Ollama model (configurable via env vars `OLLAMA_API_URL`, `OLLAMA_MODEL`) to improve the spec, and outputs the improved spec text to stdout.
*   `scripts/open-editor`: A Bash script that opens a specified project directory in VS Code (`code` command). If the project lacks a `src/` directory, it attempts to trigger a VS Code command URI (`vscode://ionutvmi.vscode-commands-executor/runCommands`) to start a new Cline task with the prompt "Follow instructions in context/SPEC.md". Also ensures a `.clinerules` file exists in the project.

## 10. MCP Server (`mcp/`)

Contains the implementation for the Model Context Protocol (MCP) server.

*   `mcp/index.ts`: Likely the entry point for the MCP server, handling communication and command execution based on the MCP specification. (Details require inspecting the file).
*   `mcp/config.ts`: Configuration for the MCP server.
*   `mcp/commands/`: Directory likely containing handlers for specific MCP commands.
*   `mcp/logic/`: Directory likely containing business logic related to MCP operations (e.g., `publish.ts`).

## 11. Component Organization Guidelines

When creating new components, follow these guidelines to maintain a consistent and logical structure:

### 11.1 Event-specific Components

All components that render Nostr events should be placed in the appropriate subdirectory under `components/events/`:

* **Notes/Tweets (kind 1)**: `components/events/note/`
  * Example: `components/events/note/card.tsx` - Renders a single note with interactions
* **Projects (kind 30023)**: `components/events/project/`
  * Example: `components/events/project/card.tsx` - Renders a project card
* **Tasks (kind 1934)**: `components/events/task/`
  * Example: `components/events/task/card.tsx` - Renders a task card

### 11.2 User-related Components

Components related to user profiles and interactions should be placed in `components/user/`:

* Example: `components/user/avatar.tsx` - Renders a user avatar

### 11.3 Provider Components

Components that provide context or services to the application should be placed in `components/providers/`:

* Example: `components/providers/theme.tsx` - Provides theme context (via `ThemeProvider`)

### 11.4 Layout Components

Components that define the overall layout of the application should be placed directly in the `components/` directory:

* Example: `components/app-layout.tsx` - Main authenticated application layout
* Example: `components/theme-provider.tsx` - Manages theme state
* Example: `components/theme-toggle.tsx` - Button to switch themes

### 11.5 UI Components

Generic UI components (often from shadcn/ui) should be placed in `components/ui/`:

* Example: `components/ui/button.tsx` - Button component
* Example: `components/ui/card.tsx` - Card component

### 11.6 Page-specific Components

Components used only on a specific page should be placed in a `components` subdirectory within that page's route directory:

* Example: `app/project/[id]/components/ProjectHeader.tsx` - Header for the project page
* Example: `app/project/[id]/components/ProjectOverviewTab.tsx` - Content for the Overview tab
* Example: `app/project/[id]/components/ProjectTasksTab.tsx` - Content for the Tasks tab
* Example: `app/project/[id]/components/ProjectSpecsTab.tsx` - Content for the Specs tab
* Example: `app/project/[id]/components/ProjectSettingsTab.tsx` - Content for the Settings tab
* Example: `app/project/[id]/components/ActivityFeed.tsx` - Displays recent activity
* Example: `app/project/[id]/components/RelatedTweets.tsx` - Displays related tweets
* Example: `app/project/[id]/components/TasksList.tsx` - List of tasks within the Tasks tab
* Example: `app/project/[id]/components/CreateTaskDialog.tsx` - Dialog to create a new task
* Example: `app/project/[id]/components/CreateIssueDialog.tsx` - Dialog to create a new issue (potentially related to tasks/projects)
* Example: `app/project/[id]/components/TaskDetailDialog.tsx` - Dialog to show task details

Following these guidelines ensures that components are organized logically and can be easily located and maintained.