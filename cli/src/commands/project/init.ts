import { initializeProject } from "../../../../shared/src/projects.js";
import { logError, logSuccess } from "../../utils/logger.js";

interface ProjectInitOptions {
    path: string;
    naddr: string;
}

export async function runProjectInit(options: ProjectInitOptions) {
    const { path: projectsDir, naddr } = options;

    try {
        const projectPath = await initializeProject({ path: projectsDir, naddr });
        
        logSuccess(`\nProject created successfully at ${projectPath}`);
        console.log(
            JSON.stringify({
                success: true,
                projectPath: projectPath,
                name: projectPath.split('/').pop(),
                configured: true,
            })
        );
        
        process.exit(0);
    } catch (err: any) {
        logError(`Failed to create project: ${err.message}`);
        process.exit(1);
    }
}