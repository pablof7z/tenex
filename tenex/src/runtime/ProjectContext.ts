import type { Agent } from "@/types/agent";
import type { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export interface ProjectContext {
  projectEvent: NDKEvent;
  projectSigner: NDKPrivateKeySigner;
  agents: Map<string, Agent>;
  projectPath: string;
  title: string;
  repository?: string;
}

let projectContext: ProjectContext | null = null;

export function initializeProjectContext(context: ProjectContext): void {
  projectContext = context;
}

export function getProjectContext(): ProjectContext {
  if (!projectContext) {
    throw new Error("Project context not initialized. Call initializeProjectContext() first.");
  }
  return projectContext;
}

export function hasProjectContext(): boolean {
  return projectContext !== null;
}
