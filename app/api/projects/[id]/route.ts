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
    let gitRepoUrl: string | undefined; // Added for potential git repo cloning

    // 1. Validate Project ID
    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 2. Parse Request Body
    try {
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            // NSEC is optional
            if (body.nsec && typeof body.nsec === 'string' && body.nsec.trim() !== '') {
                nsec = body.nsec;
            }
            // Description is optional
            if (typeof body.description === 'string' && body.description.trim() !== '') {
                description = body.description;
            } else {
                 // Use a default description if not provided
                 description = `Project specification for ${projectId}`;
            }
            // Git Repo URL is optional
            if (body.repo && typeof body.repo === 'string' && body.repo.trim() !== '') {
                gitRepoUrl = body.repo;
            }

        } else {
             return NextResponse.json({ error: 'Request body must be JSON' }, { status: 415 });
        }
    } catch (e) {
         console.error("Error parsing request body:", e);
         return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // --- Execute the create-project script ---
    try {
        const scriptPath = path.resolve(process.cwd(), 'scripts', 'create-project');
        // Ensure script path is correctly quoted if it contains spaces, though unlikely here
        const safeScriptPath = `"${scriptPath}"`;

        // Build command arguments safely
        const commandArgs = [
            safeScriptPath,
            '--id', `"${projectId.replace(/"/g, '\\"')}"`, // Basic quoting for ID
            '--desc', `"${description.replace(/"/g, '\\"')}"` // Basic quoting for description
        ];

        if (nsec) {
            commandArgs.push('--nsec', `"${nsec.replace(/"/g, '\\"')}"`); // Basic quoting
        }
        if (gitRepoUrl) {
            commandArgs.push('--repo', `"${gitRepoUrl.replace(/"/g, '\\"')}"`); // Basic quoting
        }

        const command = commandArgs.join(' ');

        console.log(`Executing script: ${command}`);
        // Execute using bun directly if preferred and available, otherwise rely on shebang
        // const commandToRun = `bun ${command}`; // Or just `command` if relying on shebang + PATH
        const { stdout, stderr } = await execAsync(command); // Use the command with args

        // Process stdout: Look for the JSON output line
        const outputLines = stdout.trim().split('\n');
        let scriptResult = null;
        for (let i = outputLines.length - 1; i >= 0; i--) {
            try {
                scriptResult = JSON.parse(outputLines[i]);
                // If parsing succeeds, break the loop
                if (scriptResult) break;
            } catch (e) {
                // Ignore lines that are not valid JSON
            }
        }

        if (scriptResult && scriptResult.success) {
            console.log(`Script executed successfully for project ${projectId}:`, scriptResult);
            return NextResponse.json({
                message: scriptResult.message || 'Project created successfully via script.',
                projectId: scriptResult.projectId,
                path: scriptResult.path,
                configured: scriptResult.configured
            }, { status: 201 });
        } else if (scriptResult && !scriptResult.success) {
            // Handle specific errors reported by the script (via JSON output)
            console.error(`Script reported failure for project ${projectId}:`, scriptResult.error);
            console.error("Full stdout:", stdout);
            console.error("Full stderr:", stderr);
            if (scriptResult.code === 'CONFLICT') {
                 // Check config status for existing project before returning conflict
                 let projectPathCheck: string;
                 try {
                     projectPathCheck = getProjectPath(projectId);
                     const isConfigured = await checkMcpConfigStatus(projectPathCheck);
                     return NextResponse.json({
                         message: scriptResult.error || 'Project directory already exists.',
                         configured: isConfigured
                     }, { status: 409 });
                 } catch (pathError: any) {
                      console.error("Error getting project path during conflict check:", pathError);
                      // Fallback to generic conflict if path fails
                      return NextResponse.json({ error: scriptResult.error || 'Project directory already exists.' }, { status: 409 });
                 }
            }
            // Generic script error reported via JSON
            return NextResponse.json({ error: `Project creation script failed: ${scriptResult.error || 'Unknown error'}` }, { status: 500 });
        } else {
             // Script finished but didn't output expected JSON success/failure
             console.error("Script finished but did not produce expected JSON output.");
             console.error("Full stdout:", stdout);
             console.error("Full stderr:", stderr);
             throw new Error("Invalid output from project creation script.");
        }

    } catch (error: any) {
        // Handle errors from execAsync itself (e.g., script not found, non-zero exit code without JSON output)
        console.error(`Error executing create-project script for ${projectId}:`, error);
        const stderr = error.stderr || '';
        const stdout = error.stdout || ''; // Include stdout for context

        // Attempt to parse the last line of stderr for a JSON error message
        const errorLines = stderr.trim().split('\n');
        let scriptErrorResult = null;
        if (errorLines.length > 0) {
             try {
                 scriptErrorResult = JSON.parse(errorLines[errorLines.length - 1]);
             } catch (e) { /* Ignore parse error */ }
        }


        if (scriptErrorResult && !scriptErrorResult.success && scriptErrorResult.error) {
             // Handle specific errors reported by the script (via stderr JSON)
             if (scriptErrorResult.code === 'CONFLICT') {
                 // Check config status for existing project before returning conflict
                 let projectPathCheck: string;
                 try {
                     projectPathCheck = getProjectPath(projectId);
                     const isConfigured = await checkMcpConfigStatus(projectPathCheck);
                     return NextResponse.json({
                         message: scriptErrorResult.error || 'Project directory already exists.',
                         configured: isConfigured
                     }, { status: 409 });
                 } catch (pathError: any) {
                      console.error("Error getting project path during conflict check:", pathError);
                      // Fallback to generic conflict if path fails
                      return NextResponse.json({ error: scriptErrorResult.error || 'Project directory already exists.' }, { status: 409 });
                 }
             }
             // Return specific error from script (stderr JSON)
             return NextResponse.json({ error: `Project creation script failed: ${scriptErrorResult.error}` }, { status: 500 });
        }

        // Generic execution error (non-zero exit without specific JSON error)
        return NextResponse.json({
             error: `Failed to execute project creation script: ${error.message}`,
             stderr: stderr,
             stdout: stdout // Include stdout for debugging context
            }, { status: 500 });
    }
}