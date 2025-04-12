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
*   `app/settings/page.tsx`: Defines `SettingsPage`, allowing users to configure application-wide settings, such as the backend API URL. Uses `AppLayout` and `SettingsForm`.

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

*   `components/providers/ndk.tsx`: (Note: This file exists but NDK is primarily managed via hooks, not context providers).

### 3.5 UI Components (`components/ui/`)

*   `components/ui/`: Contains a large collection of UI primitive components (Button, Card, Dialog, Input, Tabs, etc.), based on shadcn/ui.

### 3.6 Settings Components (`components/settings/`)

Components related to application-wide settings:

*   `components/settings/SettingsForm.tsx`: Form component for managing application settings, currently focused on the backend API URL stored in `localStorage`.

## 4. Custom Hooks (`hooks/`)

Contains custom React hooks for reusable logic.

*   `hooks/use-mobile.tsx`: Defines `useIsMobile` hook to detect mobile screen sizes.
*   `hooks/use-toast.ts`: Defines `useToast` hook and related logic for managing and displaying toast notifications.
*   `hooks/useConfig.ts`: Defines `useConfig` hook to retrieve the backend API URL from `localStorage` and provide a helper function (`getApiUrl`) to construct full API endpoint URLs.

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

Contains backend API endpoints built with Next.js API Routes. **Note:** Frontend components now use the `useConfig` hook (`hooks/useConfig.ts`) to determine the base URL for these API calls, reading the configuration from `localStorage`.

*   `app/api/projects/create-local/route.ts`
    *   **Responsibility:** Handles `POST` requests to create a new project directory structure on the local filesystem.
    *   **Called From:** `app/dashboard/page.tsx` (via `useConfig`).
*   `app/api/projects/[id]/route.ts`
    *   **Responsibility:** Handles `GET` requests to check project existence/configuration status and `POST` requests to initialize the project locally.
    *   **Called From:** `app/project/[id]/page.tsx` (via `useConfig`).
*   `app/api/projects/[id]/configure/route.ts`
    *   **Responsibility:** Handles project-specific configuration updates (saving NDK nsec).
    *   **Called From:** `app/project/[id]/page.tsx` (auto-configure effect) and `app/project/[id]/components/ProjectSettings.tsx` (via `useConfig`).
*   `app/api/projects/[id]/open-editor/route.ts`
    *   **Responsibility:** Handles `POST` requests to trigger opening the project directory in the editor.
    *   **Called From:** `app/project/[id]/page.tsx` (via `useConfig`).
*   `app/api/projects/[id]/specs/route.ts`
    *   **Responsibility:** Handles `GET` requests to retrieve project specification/rule files and `PUT` requests to update/create file content.
    *   **Called From:** `app/project/[id]/components/ProjectSpecsTab.tsx` (via `useConfig`).
*   `app/api/run/route.ts`
    *   **Responsibility:** Executes external scripts (like `scripts/improve-project-spec`).
    *   **Called From:** `app/project/[id]/components/ProjectSpecsTab.tsx` (via `useConfig`).


## 9. Scripts (`scripts/`)

Contains executable scripts for various development and operational tasks.

*   `scripts/improve-project-spec`: A Bun script that takes project details via stdin (JSON), prompts an Ollama model to improve the spec, and outputs the improved spec text to stdout.
*   `scripts/open-editor`: A Bash script that opens a specified project directory in VS Code.

## 10. MCP Server (`mcp/`)

Contains the implementation for the Model Context Protocol (MCP) server.

*   `mcp/index.ts`: Entry point for the MCP server.
*   `mcp/config.ts`: Configuration for the MCP server.
*   `mcp/commands/`: Handlers for specific MCP commands.
*   `mcp/logic/`: Business logic related to MCP operations (e.g., `publish.ts`).

## 11. Component Organization Guidelines

When creating new components, follow these guidelines to maintain a consistent and logical structure:

### 11.1 Event-specific Components

All components that render Nostr events should be placed in the appropriate subdirectory under `components/events/`:

* **Notes/Tweets (kind 1)**: `components/events/note/`
* **Projects (kind 30023)**: `components/events/project/`
* **Tasks (kind 1934)**: `components/events/task/`

### 11.2 User-related Components

Components related to user profiles and interactions should be placed in `components/user/`:

* Example: `components/user/avatar.tsx`

### 11.3 Provider Components

Components that provide context or services should be placed in `components/providers/`:

* Example: `components/providers/theme.tsx`

### 11.4 Layout Components

Components that define the overall layout should be placed directly in the `components/` directory:

* Example: `components/app-layout.tsx`
* Example: `components/theme-provider.tsx`
* Example: `components/theme-toggle.tsx`

### 11.5 UI Components

Generic UI components (often from shadcn/ui) should be placed in `components/ui/`:

* Example: `components/ui/button.tsx`

### 11.6 Settings Components

Components related to application-wide settings should be placed in `components/settings/`:

* Example: `components/settings/SettingsForm.tsx`

### 11.7 Page-specific Components

Components used only on a specific page should be placed in a `components` subdirectory within that page's route directory:

* Example: `app/project/[id]/components/ProjectHeader.tsx`
* Example: `app/project/[id]/components/ProjectOverviewTab.tsx`
* Example: `app/project/[id]/components/ProjectTasksTab.tsx`
* Example: `app/project/[id]/components/ProjectSpecsTab.tsx`
* Example: `app/project/[id]/components/ProjectSettingsTab.tsx`

Following these guidelines ensures that components are organized logically and can be easily located and maintained.