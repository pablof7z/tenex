import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { getProjectContext, isProjectContextInitialized } from "@/services";

/**
 * Check if an event is from an agent (either project agent or individual agent)
 * @param event - The NDK event to check
 * @returns true if the event is from an agent, false if from a user
 */
export function isEventFromAgent(event: NDKEvent): boolean {
  if (!event.pubkey) return false;
  
  if (!isProjectContextInitialized()) {
    // If project context is not initialized, fall back to checking tags
    // This is safer than throwing an error in utility functions
    return event.tags.some((tag) => tag[0] === "llm-model");
  }
  
  const projectCtx = getProjectContext();
  
  // Check if it's from the project itself
  console.log(`[isEventFromAgent] deciding whether the event ${event.kind} with content ${event.content.substring(0, 21)} is from the project`, { projectPubkey: projectCtx.project.pubkey, eventPubkey: event.pubkey })
  if (projectCtx.project.pubkey === event.pubkey) {
    return true;
  }
  
  // Check if it's from any of the registered agents
  for (const [_, agent] of projectCtx.agents) {
    if (agent.pubkey === event.pubkey) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if an event is from a user (not from an agent)
 * @param event - The NDK event to check
 * @returns true if the event is from a user, false if from an agent
 */
export function isEventFromUser(event: NDKEvent): boolean {
  return !isEventFromAgent(event);
}

/**
 * Get the agent slug if the event is from an agent
 * @param event - The NDK event to check
 * @returns The agent slug if found, undefined otherwise
 */
export function getAgentSlugFromEvent(event: NDKEvent): string | undefined {
  if (!event.pubkey) return undefined;
  
  if (!isProjectContextInitialized()) {
    // Project context not initialized
    return undefined;
  }
  
  const projectCtx = getProjectContext();
  for (const [slug, agent] of projectCtx.agents) {
    if (agent.pubkey === event.pubkey) {
      return slug;
    }
  }
  
  return undefined;
}

/**
 * Check if an event is from the project itself (not an individual agent)
 * @param event - The NDK event to check
 * @returns true if the event is from the project, false otherwise
 */
export function isEventFromProject(event: NDKEvent): boolean {
  if (!event.pubkey) return false;
  
  if (!isProjectContextInitialized()) {
    // Project context not initialized
    return false;
  }
  
  const projectCtx = getProjectContext();
  return projectCtx.project.pubkey === event.pubkey;
}