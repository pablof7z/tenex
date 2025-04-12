import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs'; // Keep for access check if needed, but prefer promises
import path from 'path';
import { mkdir, readFile, writeFile, access } from 'fs/promises'; // Use promises
import { exec } from 'child_process'; // For cp command
import { promisify } from 'util';
import { getProjectPath, getProjectContextPath } from '@/lib/projectUtils'; // Keep utilities

const execAsync = promisify(exec);

// Define the path to the template directory relative to the project root
const TEMPLATE_DIR = path.resolve(process.cwd(), 'project-template');
const NSEC_PLACEHOLDER = '__NSEC_PLACEHOLDER__';

// --- Helper to check MCP configuration status ---
async function checkMcpConfigStatus(projectPath: string): Promise<boolean> {
    const mcpConfigFile = path.join(projectPath, '.roo', 'mcp.json');
    try {
        const fileContent = await readFile(mcpConfigFile, 'utf-8');
        const config = JSON.parse(fileContent);
        // Check if the placeholder has been replaced
        if (config?.mcpServers?.tenex?.env?.NSEC &&
            typeof config.mcpServers.tenex.env.NSEC === 'string' &&
            config.mcpServers.tenex.env.NSEC !== NSEC_PLACEHOLDER &&
            config.mcpServers.tenex.env.NSEC.length > 0) {
            return true; // Config exists and placeholder is replaced
        }
        return false; // Structure is wrong or placeholder is still present/empty
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false; // File doesn't exist
        }
        console.error(`Error reading or parsing MCP config ${mcpConfigFile}:`, error);
        return false;
    }
}


// --- GET Handler (Updated to use new checkMcpConfigStatus logic) ---
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    let projectPath: string;
    try {
        projectPath = getProjectPath(projectId);
    } catch (error: any) {
        console.error("Error getting project path:", error);
        return NextResponse.json({ error: error.message || 'Server configuration error' }, { status: 500 });
    }

    try {
        await access(projectPath, fs.constants.F_OK); // Use promises version
        const isConfigured = await checkMcpConfigStatus(projectPath);
        return NextResponse.json({ exists: true, configured: isConfigured }, { status: 200 });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ exists: false, configured: false }, { status: 404 });
        }
        console.error(`Error checking project directory ${projectPath}:`, error);
        return NextResponse.json({ error: 'Failed to check project directory' }, { status: 500 });
    }
}


// --- POST Handler (Refactored) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    let description: string = ''; // Default description
    let nsec: string | undefined;

    // 1. Validate Project ID
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 2. Parse Request Body
    try {
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            // NSEC is now optional during initial creation
            if (body.nsec && typeof body.nsec === 'string' && body.nsec.trim() !== '') {
                nsec = body.nsec; // Assign if valid NSEC is provided
            }
            // Description is optional, default handled above
            if (typeof body.description === 'string') {
                description = body.description;
            }
        } else {
             return NextResponse.json({ error: 'Request body must be JSON' }, { status: 415 });
        }
    } catch (e) {
         console.error("Error parsing request body:", e);
         return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Remove the strict NSEC check here, as it's now optional


    let projectPath: string;
    try {
        projectPath = getProjectPath(projectId);
    } catch (error: any) {
        console.error("Error getting project path:", error);
        return NextResponse.json({ error: error.message || 'Server configuration error' }, { status: 500 });
    }

    // --- Main Project Creation Logic ---
    try {
        // 3. Check if project directory already exists
        try {
            await access(projectPath, fs.constants.F_OK);
            // If access doesn't throw, directory exists
            console.log(`Project directory already exists: ${projectPath}`);
            // Check config status for existing project
             const isConfigured = await checkMcpConfigStatus(projectPath);
            return NextResponse.json({
                message: 'Project directory already exists.',
                configured: isConfigured // Report current config status
            }, { status: 409 }); // Use 409 Conflict for existing resource

        } catch (accessError: any) {
            if (accessError.code !== 'ENOENT') {
                throw accessError; // Re-throw unexpected errors
            }
            // ENOENT: Directory doesn't exist, proceed with creation
        }

        // 4. Copy template directory
        console.log(`Copying template from ${TEMPLATE_DIR} to ${projectPath}...`);
        // Ensure TEMPLATE_DIR exists before copying
        try {
            await access(TEMPLATE_DIR, fs.constants.F_OK);
        } catch (templateAccessError: any) {
             console.error(`Template directory not found at ${TEMPLATE_DIR}:`, templateAccessError);
             throw new Error(`Server configuration error: Template directory missing.`);
        }

        // Use cp -a to preserve permissions and ownership if possible
        // Copy contents of template dir into projectPath
        await execAsync(`mkdir -p "${projectPath}" && cp -a "${TEMPLATE_DIR}/." "${projectPath}/"`);
        console.log(`Template copied successfully to ${projectPath}`);

        // 5. Update SPEC.md
        const specFilePath = path.join(projectPath, 'context', 'SPEC.md');
        try {
            await writeFile(specFilePath, description); // Write the provided description
            console.log(`SPEC.md updated successfully at ${specFilePath}`);
        } catch (specWriteError: any) {
             console.error(`Failed to write SPEC.md at ${specFilePath}:`, specWriteError);
             // Decide if this is critical. Maybe proceed but log warning?
             // For now, let's throw to indicate partial failure.
             throw new Error(`Failed to update project specification: ${specWriteError.message}`);
        }


        // 6. Update mcp.json with NSEC (only if provided)
        let isConfigured = false;
        if (nsec) {
            const mcpConfigFile = path.join(projectPath, '.roo', 'mcp.json');
            try {
                let mcpConfigContent = await readFile(mcpConfigFile, 'utf-8');
                mcpConfigContent = mcpConfigContent.replace(NSEC_PLACEHOLDER, nsec); // Replace placeholder
                await writeFile(mcpConfigFile, mcpConfigContent);
                console.log(`mcp.json updated successfully with NSEC at ${mcpConfigFile}`);
                isConfigured = true; // Mark as configured since NSEC was applied
            } catch (mcpUpdateError: any) {
                 console.error(`Failed to update mcp.json at ${mcpConfigFile}:`, mcpUpdateError);
                 // This is likely critical. Throw an error as configuration failed despite NSEC being provided.
                 throw new Error(`Failed to configure project MCP: ${mcpUpdateError.message}`);
            }
        } else {
            console.log(`NSEC not provided during creation for ${projectId}. MCP configuration pending.`);
        }

        // 7. Return Success Response
        return NextResponse.json({
            message: 'Project created successfully from template.',
            projectId: projectId,
            path: projectPath,
            configured: isConfigured // Reflect whether NSEC was applied
        }, { status: 201 });

    } catch (error: any) {
        console.error(`Error processing POST request for project ${projectId}:`, error);
        // Attempt cleanup? If copy failed partially, it might leave an incomplete dir.
        // Simple cleanup: remove the target dir if it exists after an error during creation.
        try {
             await access(projectPath, fs.constants.F_OK);
             console.warn(`Creation failed, attempting to remove partially created directory: ${projectPath}`);
             await execAsync(`rm -rf "${projectPath}"`);
        } catch (cleanupError: any) {
             console.error(`Failed to cleanup partially created directory ${projectPath}:`, cleanupError);
        }
        return NextResponse.json({ error: `Failed to create project from template: ${error.message}` }, { status: 500 });
    }
}