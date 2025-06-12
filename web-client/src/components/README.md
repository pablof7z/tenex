# Component Structure

This directory contains all React components organized by feature/domain.

## Directory Structure

### `/agents`
Agent-related components:
- `AgentCard.tsx` - Individual agent card display
- `AgentSelector.tsx` - Agent selection interface

### `/auth`
Authentication components:
- `LoginScreen.tsx` - Login interface

### `/common`
Shared/reusable components:
- `EmptyState.tsx` - Empty state display
- `ErrorState.tsx` - Error state display
- `ItemSelector.tsx` - Generic item selection component
- `LoadingState.tsx` - Loading state display
- `SearchBar.tsx` - Reusable search components
- `SelectableCard.tsx` - Generic selectable card component

### `/create-project`
Project creation wizard steps:
- `AgentSelectionStep.tsx` - Agent selection step
- `ConfirmationStep.tsx` - Final confirmation step
- `InstructionSelectionStep.tsx` - Instruction selection step
- `ProjectDetailsStep.tsx` - Basic project details step
- `TemplateSelectionStep.tsx` - Template selection step

### `/dialogs`
Modal dialogs:
- `CreateProjectDialog.tsx` - Project creation dialog
- `CreateTaskDialog.tsx` - Task creation dialog
- `TaskCreationOptionsDialog.tsx` - Task creation options
- `ThreadDialog.tsx` - Thread creation dialog
- `VoiceTaskDialog.tsx` - Voice task recording dialog

### `/instructions`
Instruction-related components:
- `InstructionCard.tsx` - Individual instruction card
- `InstructionPreviewDialog.tsx` - Instruction preview modal
- `InstructionSelector.tsx` - Instruction selection interface

### `/navigation`
Navigation components:
- `BottomTabBar.tsx` - Mobile bottom navigation

### `/projects`
Project-related components:
- `ProjectColumn.tsx` - Project column for kanban view
- `ProjectDetail.tsx` - Detailed project view
- `ProjectList.tsx` - Project list/grid view

### `/settings`
Settings page components:
- `AgentsSettings.tsx` - Agent configuration
- `MetadataSettings.tsx` - Project metadata settings
- `RulesSettings.tsx` - Rules/instructions settings

### `/tasks`
Task-related components:
- `StatusUpdate.tsx` - Task status update display
- `TaskUpdates.tsx` - Task updates feed

### `/templates`
Template-related components:
- `TemplateCard.tsx` - Individual template card
- `TemplateSelector.tsx` - Template selection interface

### `/ui`
UI primitives (from shadcn/ui):
- `avatar.tsx`
- `badge.tsx`
- `button.tsx`
- `card.tsx`
- `dialog.tsx`
- `dropdown-menu.tsx`
- `input.tsx`
- `textarea.tsx`

### Root Level Components
Page-level and layout components:
- `AgentsPage.tsx` - Agents management page
- `BackendButtons.tsx` - Backend control buttons
- `ChatInterface.tsx` - Chat interface component
- `ChatsPage.tsx` - Chats listing page
- `DesktopLayout.tsx` - Desktop layout wrapper
- `ProfileDisplay.tsx` - User profile display
- `ProjectSettings.tsx` - Project settings page
- `SettingsPage.tsx` - Main settings page