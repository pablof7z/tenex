import type { NDKEvent } from "@nostr-dev-kit/ndk";
import { projectContext } from "@/services";

/**
 * Check if an event is from an agent (either project agent or individual agent)
 * @param event - The NDK event to check
 * @returns true if the event is from an agent, false if from a user
 */
export function isEventFromAgent(event: NDKEvent): boolean {
  if (!event.pubkey) return false;
  
  try {
    // Check if it's from the project itself
    const project = projectContext.getCurrentProject();
    if (project.pubkey === event.pubkey) {
      return true;
    }
    
    // Check if it's from any of the registered agents
    const agents = projectContext.getAllAgents();
    for (const [_, agent] of agents) {
      if (agent.pubkey === event.pubkey) {
        return true;
      }
    }
  } catch (error) {
    // If project context is not initialized, fall back to checking tags
    // This is safer than throwing an error in utility functions
    return event.tags.some((tag) => tag[0] === "llm-model");
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
  
  try {
    const agents = projectContext.getAllAgents();
    for (const [slug, agent] of agents) {
      if (agent.pubkey === event.pubkey) {
        return slug;
      }
    }
  } catch (error) {
    // Project context not initialized
    return undefined;
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
  
  try {
    const project = projectContext.getCurrentProject();
    return project.pubkey === event.pubkey;
  } catch (error) {
    // Project context not initialized
    return false;
  }
}