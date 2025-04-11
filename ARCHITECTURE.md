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
*   `app/project/[id]/page.tsx`: Defines `ProjectPage`, a dynamic route displaying detailed information for a specific project (`id`). Includes tabs for Overview (activity feed, related tweets, zapping), Tasks, and Settings. Uses `AppLayout`, various UI components, and dialogs for actions like creating/quoting tweets.

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

*   `components/providers/ndk.tsx`: Provides NDK (Nostr Development Kit) context and session management

### 3.5 UI Components (`components/ui/`)

*   `components/ui/`: Contains a large collection of UI primitive components (Button, Card, Dialog, Input, Tabs, etc.), based on shadcn/ui.

## 4. Custom Hooks (`hooks/`)

Contains custom React hooks for reusable logic.

*   `hooks/use-mobile.tsx`: Defines `useIsMobile` hook to detect mobile screen sizes.
*   `hooks/use-toast.ts`: Defines `useToast` hook and related logic for managing and displaying toast notifications.

## 5. Utilities (`lib/`)

Contains utility functions.

*   `lib/utils.ts`: Defines a `cn` utility function for conditionally joining CSS class names (useful with Tailwind CSS).

## 6. Static Assets (`public/`)

Contains static files like images and logos served directly.

*   Example: `public/placeholder-logo.svg`

## 7. Styles (`styles/`)

Contains additional global styles.

*   `styles/globals.css`: Potentially overridden or supplemented by `app/globals.css`.

## 8. API Routes (`app/api/`)

Contains backend API endpoints built with Next.js API Routes.

*   `app/api/projects/create-local/route.ts`
    *   **Responsibility:** Handles `POST` requests to create a new project directory structure on the local filesystem, including the initial `context/SPEC.md` file.
    *   **Likely Called From:** `app/dashboard/page.tsx` (when creating a new project).
*   `app/api/projects/[id]/route.ts`
    *   **Responsibility:** Likely handles standard CRUD operations (`GET`, `PUT`, `DELETE`) for a specific project identified by `[id]`. (Exact implementation needs verification).
    *   **Likely Called From:** `app/project/[id]/page.tsx` or related components for fetching/updating/deleting project details.
*   `app/api/projects/[id]/configure/route.ts`
    *   **Responsibility:** Handles project-specific configuration updates.
    *   **Likely Called From:** `app/project/[id]/components/ProjectSettingsTab.tsx` or similar settings UI.
*   `app/api/projects/[id]/open-editor/route.ts`
    *   **Responsibility:** Handles `POST` requests to trigger opening the specified project's directory in the user's configured editor (via a script).
    *   **Likely Called From:** `app/project/[id]/page.tsx` or `app/dashboard/page.tsx` (e.g., an "Open in Editor" button).
*   `app/api/projects/[id]/specs/route.ts`
    *   **Responsibility:** Handles `GET` requests to retrieve project specification files (e.g., `SPEC.md`) and `PUT` requests to update the `SPEC.md` file content.
    *   **Likely Called From:** `app/project/[id]/components/ProjectSpecsTab.tsx` (for displaying and editing the spec).
*   `app/api/run/route.ts`
    *   **Responsibility:** Purpose needs further investigation based on implementation. Could be for running project-related commands or processes.
    *   **Likely Called From:** Potentially various parts of the application depending on its function.


## 9. Component Organization Guidelines

When creating new components, follow these guidelines to maintain a consistent and logical structure:

### 9.1 Event-specific Components

All components that render Nostr events should be placed in the appropriate subdirectory under `components/events/`:

* **Notes/Tweets (kind 1)**: `components/events/note/`
  * Example: `components/events/note/card.tsx` - Renders a single note with interactions
  * Example: `components/events/note/list.tsx` - Renders a list of notes

* **Projects (kind 30023)**: `components/events/project/`
  * Example: `components/events/project/card.tsx` - Renders a project card
  * Example: `components/events/project/detail.tsx` - Renders detailed project view

* **Tasks**: `components/events/task/`
  * Example: `components/events/task/card.tsx` - Renders a task card
  * Example: `components/events/task/list.tsx` - Renders a list of tasks

### 9.2 User-related Components

Components related to user profiles and interactions should be placed in `components/user/`:

* Example: `components/user/avatar.tsx` - Renders a user avatar
* Example: `components/user/profile.tsx` - Renders a user profile
* Example: `components/user/login.tsx` - Handles user login

### 9.3 Provider Components

Components that provide context or services to the application should be placed in `components/providers/`:

* Example: `components/providers/ndk.tsx` - Provides NDK context and session management
* Example: `components/providers/theme.tsx` - Provides theme context

### 9.4 Layout Components

Components that define the overall layout of the application should be placed directly in the `components/` directory:

* Example: `components/app-layout.tsx` - Main application layout
* Example: `components/sidebar.tsx` - Sidebar navigation

### 9.5 UI Components

Generic UI components that are not specific to Nostr should be placed in `components/ui/`:

* Example: `components/ui/button.tsx` - Button component
* Example: `components/ui/card.tsx` - Card component

### 9.6 Page-specific Components

Components that are only used on a specific page and not shared across the application should be placed in the corresponding page directory:

* Example: `app/dashboard/components/stats.tsx` - Dashboard-specific stats component
* Example: `app/project/[id]/components/header.tsx` - Project page header

Following these guidelines ensures that components are organized logically and can be easily located and maintained.