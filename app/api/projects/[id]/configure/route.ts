import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';

// Ensure PROJECTS_PATH is set in your environment variables
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
    console.error("FATAL: PROJECTS_PATH environment variable is not set.");
    // We need this path to find the project, so fail early if not set.
}

// --- MCP Configuration Logic (Copied from ../route.ts) ---
// Note: In a larger app, consider moving shared logic to a lib/ directory
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
             await fs.promises.access(projectPath, fs.constants.F_OK);
        } catch (projectAccessError: any) {
             if (projectAccessError.code === 'ENOENT') {
                 return { success: false, error: `Project directory not found at ${projectPath}` };
             }
             throw projectAccessError; // Re-throw other access errors
        }


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

    } catch (error: any) {
        console.error(`Error configuring MCP for project ${projectPath}:`, error);
        return { success: false, error: `Failed to configure MCP: ${error.message}` };
    }
}


// --- POST Handler for Configuration ---
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const projectId = params.id;
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
    } catch (e) {
         console.error("Error parsing request body:", e);
         return NextResponse.json({ error: 'Invalid request body. Expecting JSON with nsec.' }, { status: 400 });
    }

    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const projectPath = path.join(PROJECTS_PATH, projectId);

    const result = await configureProjectMcp(projectPath, nsec);

    if (result.success) {
        return NextResponse.json({ message: result.message || 'MCP configuration updated successfully.' }, { status: 200 });
    } else {
        // Determine appropriate status code based on error (e.g., 404 if project dir not found)
        const status = result.error?.includes('not found') ? 404 : 500;
        return NextResponse.json({ error: result.error || 'Failed to configure MCP.' }, { status });
    }
}