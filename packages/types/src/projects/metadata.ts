/**
 * Project metadata types
 */

/**
 * Project metadata stored in .tenex/metadata.json
 */
export interface ProjectMetadata {
    name?: string;
    title: string;
    description?: string;
    repoUrl?: string | null;
    projectNaddr: string;
    template?: string | null;
    createdAt?: number;
    updatedAt?: number;
    version?: string;
    author?: string;
    tags?: string[];
}

/**
 * Project info for runtime use
 */
export interface ProjectInfo {
    name: string;
    path: string;
    exists: boolean;
    metadata?: ProjectMetadata;
}

/**
 * Project initialization options
 */
export interface ProjectInitOptions {
    path: string;
    naddr: string;
    force?: boolean;
    skipGit?: boolean;
    skipAgents?: boolean;
}


/**
 * Project rules structure
 */
export interface ProjectRules {
    general?: string[];
    agents?: Record<string, string[]>;
    files?: Record<string, string[]>;
    directories?: Record<string, string[]>;
}

/**
 * Project status information (from backend API)
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
