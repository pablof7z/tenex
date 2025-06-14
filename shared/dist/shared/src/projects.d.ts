import type { ProjectInfo, ProjectInitOptions } from "@tenex/types/projects";
export { toKebabCase, updateAgentConfig, } from "./agents/index.js";
export type { ProjectInitOptions, ProjectInfo } from "@tenex/types/projects";
export declare function extractProjectIdentifierFromTag(aTag: string): string;
export declare function checkProjectExists(projectsPath: string, projectIdentifier: string): Promise<ProjectInfo>;
export declare function initializeProject(options: ProjectInitOptions): Promise<string>;
//# sourceMappingURL=projects.d.ts.map