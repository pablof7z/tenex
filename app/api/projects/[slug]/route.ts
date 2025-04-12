import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs'; // Keep for access check if needed, but prefer promises
import path from 'path';
import { readFile, access } from 'fs/promises'; // Use promises
import { exec } from 'child_process'; // For cp command
import { promisify } from 'util';
import { getProjectPath } from '@/lib/projectUtils'; // Keep utilities

const execAsync = promisify(exec);

// Define the path to the template directory relative to the project root
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
    } catch (error: unknown) {
        // Check if it's an error object with a 'code' property
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return false; // File doesn't exist
        }
        console.error(`Error reading or parsing MCP config ${mcpConfigFile}:`, error);
        return false;
    }
}


// --- GET Handler (Updated to use slug) ---
export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } } // Changed id to slug
) {
    const projectSlug = params.slug; // Changed projectId to projectSlug
    if (!projectSlug) {
        return NextResponse.json({ error: 'Project slug is required' }, { status: 400 }); // Updated error message
    }

    let projectPath: string;
    try {
        projectPath = getProjectPath(projectSlug); // Use projectSlug
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server configuration error';
        console.error("Error getting project path:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
        await access(projectPath, fs.constants.F_OK); // Use promises version
        const isConfigured = await checkMcpConfigStatus(projectPath);
        return NextResponse.json({ exists: true, configured: isConfigured }, { status: 200 });
    } catch (error: unknown) {
        // Check if it's an error object with a 'code' property
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            return NextResponse.json({ exists: false, configured: false }, { status: 404 });
        }
        console.error(`Error checking project directory ${projectPath}:`, error);
        return NextResponse.json({ error: 'Failed to check project directory' }, { status: 500 });
    }
}


// --- POST Handler (Updated to use slug) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { slug: string } } // Changed id to slug
) {
    const projectSlug = params.slug; // Changed projectId to projectSlug
    let description: string = ''; // Default description
    let nsec: string; // *** CHANGED: No longer optional ***
    let gitRepoUrl: string | undefined;
    let eventId: string | undefined; // Added for the project event ID
    let title: string; // Added for the project title
    let hashtags: string | undefined; // Added for hashtags

    // 1. Validate Project Slug
    if (!projectSlug) {
        return NextResponse.json({ error: 'Project slug is required' }, { status: 400 }); // Updated error message
    }

    // 2. Parse Request Body
    try {
        if (request.headers.get('content-type')?.includes('application/json')) {
            const body = await request.json();
            // Title is REQUIRED
            if (body.title && typeof body.title === 'string' && body.title.trim() !== '') {
                title = body.title;
            } else {
                return NextResponse.json({ error: 'title is required in the request body' }, { status: 400 });
            }
            // NSEC is REQUIRED
            if (body.nsec && typeof body.nsec === 'string' && body.nsec.trim() !== '') {
                nsec = body.nsec;
            } else { // *** ADDED: Error if nsec is missing/invalid ***
                return NextResponse.json({ error: 'nsec is required in the request body' }, { status: 400 });             }
            // Description is optional
            if (typeof body.description === 'string' && body.description.trim() !== '') {
                description = body.description;
            } else {
                 // Use a default description if not provided
                 description = `Project specification for ${projectSlug}`; // Use projectSlug
            }
            // Git Repo URL is optional
            if (body.repo && typeof body.repo === 'string' && body.repo.trim() !== '') {
                gitRepoUrl = body.repo;
            }
            // Hashtags are optional (expecting comma-separated string)
             if (body.hashtags && typeof body.hashtags === 'string' && body.hashtags.trim() !== '') {
                hashtags = body.hashtags;
            }
            // Event ID is REQUIRED
            if (body.eventId && typeof body.eventId === 'string' && body.eventId.trim() !== '') {
                eventId = body.eventId;
            } else {
                // If eventId is missing or invalid, return an error immediately
                return NextResponse.json({ error: 'eventId is required in the request body' }, { status: 400 });
            }

        } else {
             return NextResponse.json({ error: 'Request body must be JSON' }, { status: 415 });
        }
    } catch (e: unknown) {
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
            '--slug', `"${projectSlug.replace(/"/g, '\\"')}"`, // *** CORRECTED: Use --slug ***
            '--desc', `"${description.replace(/"/g, '\\"')}"`,
            '--eventId', `"${eventId!.replace(/"/g, '\\"')}"`, // eventId is guaranteed by validation
            '--title', `"${title.replace(/"/g, '\\"')}"` // Add title argument
        ];

        commandArgs.push('--nsec', `"${nsec.replace(/"/g, '\\"')}"`); // *** CHANGED: Always add nsec ***
        if (gitRepoUrl) {
            commandArgs.push('--repo', `"${gitRepoUrl.replace(/"/g, '\\"')}"`);
        }
        if (hashtags) {
            commandArgs.push('--hashtags', `"${hashtags.replace(/"/g, '\\"')}"`);
        }


        const command = commandArgs.join(' ');

        // Removed debug logs from previous step
        console.log(`Executing script: ${command}`); // Keep this log for confirmation
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
            console.log(`Script executed successfully for project ${projectSlug}:`, scriptResult); // Use projectSlug
            return NextResponse.json({
                message: scriptResult.message || 'Project created successfully via script.',
                projectSlug: scriptResult.projectSlug, // Changed projectId to projectSlug
                path: scriptResult.path,
                configured: scriptResult.configured
            }, { status: 201 });
        } else if (scriptResult && !scriptResult.success) {
            // Handle specific errors reported by the script (via JSON output)
            console.error(`Script reported failure for project ${projectSlug}:`, scriptResult.error); // Use projectSlug
            console.error("Full stdout:", stdout);
            console.error("Full stderr:", stderr);
            if (scriptResult.code === 'CONFLICT') {
                 // Check config status for existing project before returning conflict
                 let projectPathCheck: string;
                 try {
                     projectPathCheck = getProjectPath(projectSlug); // Use projectSlug
                     const isConfigured = await checkMcpConfigStatus(projectPathCheck);
                     return NextResponse.json({
                         message: scriptResult.error || 'Project directory already exists.',
                         configured: isConfigured
                     }, { status: 409 });
                 } catch (pathError: unknown) {
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

    } catch (error: unknown) {
        // Handle errors from execAsync itself (e.g., script not found, non-zero exit code without JSON output)
        console.error(`Error executing create-project script for ${projectSlug}:`, error); // Use projectSlug
        // Try to access stderr/stdout if error is an object, otherwise default to empty strings
        const stderr = (typeof error === 'object' && error !== null && 'stderr' in error) ? String(error.stderr) : '';
        const stdout = (typeof error === 'object' && error !== null && 'stdout' in error) ? String(error.stdout) : ''; // Include stdout for context

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
                     projectPathCheck = getProjectPath(projectSlug); // Use projectSlug
                     const isConfigured = await checkMcpConfigStatus(projectPathCheck);
                     return NextResponse.json({
                         message: scriptErrorResult.error || 'Project directory already exists.',
                         configured: isConfigured
                     }, { status: 409 });
                 } catch (pathError: unknown) {
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
             error: `Failed to execute project creation script: ${error instanceof Error ? error.message : String(error)}`,
             stderr: stderr,
             stdout: stdout // Include stdout for debugging context
            }, { status: 500 });
    }
}