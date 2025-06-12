import type { ProjectInfo, ProjectInitOptions } from "./types/index.js";
export { toKebabCase, updateAgentConfig, type AgentsJson, } from "./agents/index.js";
export type { AgentConfig } from "./agents/index.js";
export type { ProjectInitOptions, ProjectInfo } from "./types/index.js";
export declare function extractProjectIdentifierFromTag(aTag: string): string;
export declare function checkProjectExists(projectsPath: string, projectIdentifier: string): Promise<ProjectInfo>;
export declare function initializeProject(options: ProjectInitOptions): Promise<string>;
