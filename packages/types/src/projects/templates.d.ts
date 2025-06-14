/**
 * Project template types
 */
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
/**
 * Template metadata for kind 30717 events
 */
export interface TemplateEventMetadata {
    title: string;
    description?: string;
    uri?: string;
    image?: string;
    command?: string;
    topics?: string[];
    agent?: string;
}
//# sourceMappingURL=templates.d.ts.map