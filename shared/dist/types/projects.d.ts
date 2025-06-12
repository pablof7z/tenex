/**
 * Project initialization options
 */
export interface ProjectInitOptions {
    path: string;
    naddr: string;
}
/**
 * Project information
 */
export interface ProjectInfo {
    name: string;
    path: string;
    exists: boolean;
}
/**
 * Project metadata stored in .tenex/metadata.json
 */
export interface ProjectMetadata {
    title: string;
    description?: string;
    repoUrl?: string | null;
    projectNaddr: string;
    template?: string | null;
    name?: string;
}
/**
 * Project status information (from backend)
 */
export interface ProjectStatus {
    name: string;
    title?: string;
    description?: string;
    naddr?: string;
    agentCount: number;
    lastSeen?: number;
    status?: "online" | "offline";
}
/**
 * Template project data
 */
export interface ProjectTemplate {
    id: string;
    name: string;
    title: string;
    description: string;
    repoUrl?: string;
    tags?: string[];
    agent?: {
        name: string;
        model: string;
        mcpServers?: string[];
    };
}
