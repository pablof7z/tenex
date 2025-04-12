import path from 'path';

// Ensure PROJECTS_PATH is set in your environment variables
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
    // Throw an error during initialization if the path is not set.
    // This prevents the server from starting in an invalid state.
    throw new Error("FATAL: PROJECTS_PATH environment variable is not set.");
}

/**
 * Gets the absolute path for a given project ID.
 * Throws an error if the base PROJECTS_PATH environment variable is not set.
 * @param projectId - The ID of the project.
 * @returns The absolute path to the project directory.
 */
export function getProjectPath(projectId: string): string {
    if (!projectId) {
        throw new Error("Project ID cannot be empty.");
    }
    // PROJECTS_PATH check is done at module load time.
    return path.join(PROJECTS_PATH!, projectId); // Non-null assertion is safe due to the check above
}

/**
 * Gets the absolute path to the context directory within a given project ID.
 * @param projectId - The ID of the project.
 * @returns The absolute path to the project's context directory.
 */
export function getProjectContextPath(projectId: string): string {
    const projectPath = getProjectPath(projectId);
    return path.join(projectPath, 'context');
}

/**
 * Gets the absolute path to the rules directory within a given project ID.
 * @param projectId - The ID of the project.
 * @returns The absolute path to the project's rules directory.
 */
export function getProjectRulesPath(projectId: string): string {
    const projectPath = getProjectPath(projectId);
    // Use path.join to correctly handle the hidden directory '.roo'
    return path.join(projectPath, '.roo', 'rules');
}