# LLM Model Change Feature - Fix Summary

## The Problem
The hover card wasn't showing the "Change Model" button because it was incorrectly trying to identify agents by checking `profile?.kind === 4199`, but profile objects from `useProfileValue` don't have a `kind` property.

## The Solution
1. Added `useProjectAgents` hook to get the list of agent pubkeys from project status events
2. Pass an `isAgent` boolean prop based on whether the participant's pubkey is in the agent list
3. Added `projectId` prop through the component chain so we can fetch the correct project agents

## Changes Made

### ParticipantAvatarsWithModels.tsx
- Import `useProjectAgents` hook
- Add `projectId` prop
- Create a Set of agent pubkeys for efficient lookup
- Pass `isAgent={agentPubkeys.has(pubkey)}` to each avatar
- Remove incorrect `profile?.kind === 4199` check

### ChatHeader.tsx
- Add `projectId` prop to interface
- Pass it through to ParticipantAvatarsWithModels

### ChatInterface.tsx
- Pass `projectId={project?.tagId()}` to ChatHeader

## How It Works Now

1. `useProjectAgents` subscribes to kind 24010 status events for the project
2. It extracts agent information from p-tags (which include pubkey and name)
3. The component checks if each participant's pubkey is in this agent list
4. For agents with LLM model information, it shows:
   - Current model badge with CPU icon
   - "Change Model" button in the hover card
5. Clicking "Change Model" opens the dialog to select a new model

## Testing

1. Ensure `tenex run` is running (publishes agent info in status events)
2. Open a thread with agent participants
3. Hover over an agent's avatar in the thread header
4. You should now see the "Change Model" button for agents