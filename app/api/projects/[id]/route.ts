import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { exec } from 'child_process'; // For git commands
import { promisify } from 'util';
import { getProjectPath } from '@/lib/projectUtils'; // Import the new utility

const execAsync = promisify(exec);

// PROJECTS_PATH check is now handled within getProjectPath in projectUtils.ts

// --- Helper to check MCP configuration status ---
async function checkMcpConfigStatus(projectPath: string): Promise<boolean> {
    const mcpConfigFile = path.join(projectPath, '.roo', 'mcp.json');
    try {
        const fileContent = await readFile(mcpConfigFile, 'utf-8');
        const config = JSON.parse(fileContent);
        // Check for the specific structure and presence of an NSEC string
        if (config?.mcpServers?.tenex?.env?.NSEC && typeof config.mcpServers.tenex.env.NSEC === 'string' && config.mcpServers.tenex.env.NSEC.length > 0) {
            return true; // Config exists and has an NSEC value
        }
        return false; // Structure is wrong or NSEC is missing/empty
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return false; // File doesn't exist
        }
        // Log other errors but return false as it's not configured correctly
        console.error(`Error reading or parsing MCP config ${mcpConfigFile}:`, error);
        return false;
    }
}

// --- GET Handler (Updated) ---
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;

    // projectId check remains
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    let projectPath: string;
    try {
        // Use the utility function to get the project path
        projectPath = getProjectPath(projectId);
    } catch (error: any) {
        // Handle potential errors from getProjectPath (e.g., PROJECTS_PATH not set)
        console.error("Error getting project path:", error);
        return NextResponse.json({ error: error.message || 'Server configuration error' }, { status: 500 });
    }

    try {
        await fs.promises.access(projectPath, fs.constants.F_OK);
        // Directory exists, now check configuration status
        const isConfigured = await checkMcpConfigStatus(projectPath);
        return NextResponse.json({ exists: true, configured: isConfigured }, { status: 200 });

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // Directory doesn't exist
            return NextResponse.json({ exists: false, configured: false }, { status: 404 });
        }
        // Other error checking directory
        console.error(`Error checking project directory ${projectPath}:`, error);
        return NextResponse.json({ error: 'Failed to check project directory' }, { status: 500 });
    }
}


// --- MCP Configuration Logic (configureProjectMcp - unchanged) ---
async function configureProjectMcp(projectPath: string, nsec: string | undefined): Promise<{ success: boolean; error?: string; message?: string }> {
    if (!nsec) {
        console.warn(`NSEC not provided for project path ${projectPath}, skipping MCP configuration.`);
        // Not necessarily an error, just can't configure without nsec
        return { success: true, message: "MCP config skipped (NSEC not provided)." };
    }

    const rooDir = path.join(projectPath, '.roo');
    const mcpConfigFile = path.join(rooDir, 'mcp.json');

    try {
        // Ensure .roo directory exists
        await mkdir(rooDir, { recursive: true });

        let config: any = {};
        try {
            const fileContent = await readFile(mcpConfigFile, 'utf-8');
            config = JSON.parse(fileContent);
        } catch (readError: any) {
            if (readError.code !== 'ENOENT') {
                throw readError; // Re-throw if it's not a "file not found" error
            }
            // File doesn't exist, start with empty config (which is already the default)
            console.log(`mcp.json not found at ${mcpConfigFile}, creating new one.`);
        }

        // Ensure mcpServers structure exists
        if (!config.mcpServers) {
            config.mcpServers = {};
        }

        // Add or update the 'tenex' server configuration
        config.mcpServers.tenex = {
            // IMPORTANT: Adjust this path as needed for your environment
            command: "/Users/pablofernandez/ai/nostr-project/mcp/tenex",
            args: [],
            alwaysAllow: ["publish"],
            env: {
                NSEC: nsec // Use the provided NSEC
            },
        };

        // Write the updated config back to the file
        await writeFile(mcpConfigFile, JSON.stringify(config, null, 2)); // Pretty print JSON
        console.log(`MCP configuration updated successfully at ${mcpConfigFile}`);
        return { success: true, message: "MCP configuration updated successfully." };

    } catch (error: any) {
        console.error(`Error configuring MCP for project ${projectPath}:`, error);
        return { success: false, error: `Failed to configure MCP: ${error.message}` };
    }
}


// --- POST Handler (Updated) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
    let repoUrl: string | undefined;
    // NSEC is not expected during initial creation via this POST anymore
    // let nsec: string | undefined;

    try {
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            repoUrl = body.repoUrl;
            // nsec = body.nsec; // Removed
        }
    } catch (e) {
         console.warn("Could not parse request body as JSON or body is empty:", e);
    }


    // projectId check remains
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    let projectPath: string;
     try {
        // Use the utility function to get the project path
        projectPath = getProjectPath(projectId);
    } catch (error: any) {
        // Handle potential errors from getProjectPath (e.g., PROJECTS_PATH not set)
        console.error("Error getting project path:", error);
        return NextResponse.json({ error: error.message || 'Server configuration error' }, { status: 500 });
    }
    let gitSetupResult: { success: boolean; message?: string; warning?: string } = { success: true, message: "Git setup not needed or skipped.", warning: "" };
    let mcpConfigResult: { success: boolean; message?: string; error?: string } = { success: true, message: "MCP config skipped." };
    let directoryCreated = false;

    try {
        // 1. Check/Create Directory
        try {
            await fs.promises.access(projectPath, fs.constants.F_OK);
            console.log(`Project directory already exists: ${projectPath}`);
             // If directory exists, check config status but don't configure here.
             const isConfigured = await checkMcpConfigStatus(projectPath);
             mcpConfigResult = { success: true, message: isConfigured ? "MCP already configured." : "MCP not configured." };

            return NextResponse.json({
                message: 'Project directory already exists.',
                git: gitSetupResult,
                mcp: mcpConfigResult
            }, { status: 200 });
        } catch (accessError: any) {
            if (accessError.code !== 'ENOENT') {
                throw accessError; // Re-throw if it's not a "not found" error
            }
            // Directory doesn't exist, proceed to create
            await mkdir(projectPath, { recursive: true });
            directoryCreated = true;
            console.log(`Project directory created: ${projectPath}`);
        }

        // 2. Setup Git (only if directory was newly created)
        // NOTE: Git commands are executed externally via 'execAsync' for simplicity here.
        // In a production scenario, consider using a library like 'simple-git'
        // or ensuring robust error handling and security with direct exec calls.
        if (directoryCreated) {
            let gitInitialized = false;
            if (repoUrl) {
                try {
                    console.log(`Attempting to clone ${repoUrl} into ${projectPath}...`);
                    // Ensure the URL is properly escaped for the shell command
                    const escapedRepoUrl = repoUrl.replace(/'/g, "'\\''"); // Basic escaping for single quotes
                    await execAsync(`git clone '${escapedRepoUrl}' .`, { cwd: projectPath });
                    gitSetupResult = { success: true, message: `Successfully cloned ${repoUrl}.`, warning: "" };
                    console.log(`Successfully cloned ${repoUrl} into ${projectPath}`);
                    gitInitialized = true; // Cloned repo is initialized
                } catch (cloneError: any) {
                    console.warn(`Failed to clone repository ${repoUrl}: ${cloneError.message}. Proceeding with git init.`);
                    gitSetupResult = { success: true, message: `Failed to clone ${repoUrl}, initialized empty repository instead.`, warning: `Clone failed: ${cloneError.message}` };
                    // Fall through to git init
                }
            }

            if (!gitInitialized) {
                try {
                    console.log(`Initializing empty git repository in ${projectPath}...`);
                    await execAsync('git init', { cwd: projectPath });
                    gitSetupResult = { success: true, message: 'Initialized empty git repository.', warning: gitSetupResult.warning }; // Keep potential clone warning
                    console.log(`Initialized empty git repository in ${projectPath}`);
                } catch (initError: any) {
                    console.error(`Failed to initialize git repository in ${projectPath}: ${initError.message}`);
                    // This might be more serious, but per instructions, continue
                    gitSetupResult = { success: false, message: `Failed to initialize git repository: ${initError.message}`, warning: gitSetupResult.warning };
                }
            }
        } else {
             gitSetupResult.message = "Git setup skipped (directory already existed).";
        }


        // 3. Configure MCP - No longer done here, only via /configure endpoint or triggered by frontend after GET
         mcpConfigResult = { success: true, message: "MCP configuration to be handled by /configure endpoint." };


        // Determine overall status based on directory creation and critical failures (like MCP config if required?)
        // For now, return 201 if directory was created, even if git/mcp had issues (warnings/errors included in response)
        return NextResponse.json({
            message: 'Project directory created successfully.',
            git: gitSetupResult,
            mcp: mcpConfigResult // Report initial status (will be not configured)
        }, { status: 201 });

    } catch (error: any) {
        console.error(`Error processing POST request for project ${projectId}:`, error);
        // Clean up partially created directory? Maybe not necessary.
        return NextResponse.json({ error: `Failed to create or configure project: ${error.message}` }, { status: 500 });
    }
}