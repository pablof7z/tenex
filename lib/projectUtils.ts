import path from "path";

// Ensure PROJECTS_PATH is set in your environment variables
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
    // Throw an error during initialization if the path is not set.
    // This prevents the server from starting in an invalid state.
    throw new Error("FATAL: PROJECTS_PATH environment variable is not set.");
}

/**
 * Gets the absolute path for a given project slug.
 * Throws an error if the base PROJECTS_PATH environment variable is not set.
 * @param projectSlug - The slug (d tag identifier) of the project.
 * @returns The absolute path to the project directory.
 */
export function getProjectPath(projectSlug: string): string {
    if (!projectSlug) {
        throw new Error("Project slug cannot be empty.");
    }
    // PROJECTS_PATH check is done at module load time.
    return path.join(PROJECTS_PATH!, projectSlug); // Non-null assertion is safe due to the check above
}

/**
 * Gets the absolute path to the context directory within a given project slug.
 * @param projectSlug - The slug (d tag identifier) of the project.
 * @returns The absolute path to the project's context directory.
 */
export function getProjectContextPath(projectSlug: string): string {
    const projectPath = getProjectPath(projectSlug);
    return path.join(projectPath, "context");
}

/**
 * Gets the absolute path to the rules directory within a given project slug.
 * @param projectSlug - The slug (d tag identifier) of the project.
 * @returns The absolute path to the project's rules directory.
 */
export function getProjectRulesPath(projectSlug: string): string {
    const projectPath = getProjectPath(projectSlug);
    // Use path.join to correctly handle the hidden directory '.roo'
    return path.join(projectPath, ".roo", "rules");
}
