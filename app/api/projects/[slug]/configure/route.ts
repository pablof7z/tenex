import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mkdir, readFile, writeFile, access } from 'fs/promises'; // Use access from promises
import { getProjectPath } from '@/lib/projectUtils'; // Import utility

// Ensure PROJECTS_PATH is set in your environment variables
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
    console.error("FATAL: PROJECTS_PATH environment variable is not set.");
    // We need this path to find the project, so fail early if not set.
}

// --- MCP Configuration Logic ---
// Define a basic type for the MCP config structure
interface McpConfig {
    mcpServers?: {
        [serverName: string]: {
            command?: string;
            args?: string[];
            alwaysAllow?: string[];
            env?: Record<string, string | undefined>;
        };
    };
}

async function configureProjectMcp(projectPath: string, nsec: string | undefined): Promise<{ success: boolean; error?: string; message?: string }> {
    if (!nsec) {
        // For the dedicated configure endpoint, NSEC is required.
        return { success: false, error: "NSEC is required for configuration." };
    }
     if (!PROJECTS_PATH) {
        // Added check here as well for safety, though the top-level check should catch it.
        return { success: false, error: 'Server configuration error: PROJECTS_PATH not set' };
    }

    const rooDir = path.join(projectPath, '.roo');
    const mcpConfigFile = path.join(rooDir, 'mcp.json');

    try {
        // First, check if the main project directory exists. Don't create it here.
        try {
             await access(projectPath, fs.constants.F_OK); // Use promises version
        } catch (projectAccessError: unknown) {
             // Check if it's an error object with a 'code' property
             if (typeof projectAccessError === 'object' && projectAccessError !== null && 'code' in projectAccessError && projectAccessError.code === 'ENOENT') {
                 return { success: false, error: `Project directory not found at ${projectPath}` };
             }
             throw projectAccessError; // Re-throw other access errors
        }


        // Ensure .roo directory exists
        await mkdir(rooDir, { recursive: true });

        let config: McpConfig = {}; // Use the defined interface
        try {
            const fileContent = await readFile(mcpConfigFile, 'utf-8');
            config = JSON.parse(fileContent);
        } catch (readError: unknown) {
            // Check if it's an error object with a 'code' property
            if (typeof readError === 'object' && readError !== null && 'code' in readError && readError.code !== 'ENOENT') {
                throw readError; // Re-throw if it's not a "file not found" error
            }
            // File doesn't exist, start with empty config
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

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error configuring MCP for project ${projectPath}:`, error);
        return { success: false, error: `Failed to configure MCP: ${message}` };
    }
}


// --- POST Handler for Configuration (Updated to use slug) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { slug: string } } // Changed id to slug
) {
    const projectSlug = params.slug; // Changed projectId to projectSlug
    let nsec: string | undefined;

     if (!PROJECTS_PATH) {
        // Redundant check, but safe.
        return NextResponse.json({ error: 'Server configuration error: PROJECTS_PATH not set' }, { status: 500 });
    }

    try {
        // NSEC is required for this endpoint
        const body = await request.json();
        nsec = body.nsec;
        if (!nsec || typeof nsec !== 'string') {
             return NextResponse.json({ error: 'NSEC (string) is required in the request body' }, { status: 400 });
        }
    } catch (e: unknown) {
         console.error("Error parsing request body:", e);
         return NextResponse.json({ error: 'Invalid request body. Expecting JSON with nsec.' }, { status: 400 });
    }

    if (!projectSlug) {
        return NextResponse.json({ error: 'Project slug is required' }, { status: 400 }); // Updated error message
    }

    let projectPath: string;
    try {
        projectPath = getProjectPath(projectSlug); // Use utility function with slug
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Server configuration error';
        console.error("Error getting project path:", error);
        // If getProjectPath throws (e.g., empty slug), return a 400 or 500
        return NextResponse.json({ error: message }, { status: error instanceof Error && error.message.includes("cannot be empty") ? 400 : 500 });
    }


    const result = await configureProjectMcp(projectPath, nsec);

    if (result.success) {
        return NextResponse.json({ message: result.message || 'MCP configuration updated successfully.' }, { status: 200 });
    } else {
        // Determine appropriate status code based on error (e.g., 404 if project dir not found)
        const status = result.error?.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: result.error || 'Failed to configure MCP.' }, { status });
    }
}