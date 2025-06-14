import { logError, logSuccess } from "@tenex/shared/logger";
import { initializeProject } from "@tenex/shared/node";
import { formatError } from "../../utils/errors";

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
                name: projectPath.split("/").pop(),
                configured: true,
            })
        );

        process.exit(0);
    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to create project: ${errorMessage}`);
        process.exit(1);
    }
}
