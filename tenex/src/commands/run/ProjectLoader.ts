import path from "node:path";
import { getNDK } from "@/nostr/ndkClient";
import { NDKPrivateKeySigner, type NDKProject } from "@nostr-dev-kit/ndk";
import * as fileSystem from "@/lib/fs";
import { logError, logInfo } from "@/utils/logger";
import { projectContext, type LoadedAgent } from "@/services";
import { EVENT_KINDS } from "@/types/llm";
import { nip19 } from "nostr-tools";
import { generateSecretKey } from "nostr-tools";

export interface ProjectRuntimeInfo {
  projectEvent: NDKProject;
  projectPath: string;
  title: string;
  repository: string;
  projectId: string;
  projectSigner: NDKPrivateKeySigner;
  agents: Map<string, LoadedAgent>;
}

export class ProjectLoader {
  async loadProject(projectPath: string): Promise<ProjectRuntimeInfo> {
    // ProjectContext should already be initialized by ProjectManager
    if (!projectContext.isInitialized()) {
      throw new Error(
        "ProjectContext not initialized. Ensure ProjectManager.loadAndInitializeProjectContext() was called first."
      );
    }

    const projectEvent = projectContext.getCurrentProject();
    const projectNsec = projectContext.getCurrentProjectNsec();
    const agents = projectContext.getAllAgents();

    // Create project signer from context
    const projectSigner = new NDKPrivateKeySigner(projectNsec);

    return this.extractProjectInfo(
      projectEvent,
      projectPath,
      projectSigner,
      agents
    );
  }

  private extractProjectInfo(
    projectEvent: NDKProject,
    projectPath: string,
    projectSigner: NDKPrivateKeySigner,
    agents: Map<string, LoadedAgent>
  ): ProjectRuntimeInfo {
    const titleTag = projectEvent.tags.find((tag) => tag[0] === "title");
    const repoTag = projectEvent.tags.find((tag) => tag[0] === "repo");
    const dTag = projectEvent.tags.find((tag) => tag[0] === "d");

    return {
      projectEvent,
      projectPath,
      title: titleTag?.[1] || "Untitled Project",
      repository: repoTag?.[1] || "No repository",
      projectId: dTag?.[1] || "",
      projectSigner,
      agents,
    };
  }
}