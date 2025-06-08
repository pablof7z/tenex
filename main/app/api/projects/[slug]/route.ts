import { exec } from "child_process"; // For cp command
import fs from "fs"; // Keep for access check if needed, but prefer promises
import path from "path";
import { promisify } from "util";
import { getProjectPath } from "@/lib/projectUtils"; // Keep utilities
import { access, readFile } from "fs/promises"; // Use promises
import { type NextRequest, NextResponse } from "next/server";

const execAsync = promisify(exec);

// Define the path to the template directory relative to the project root
const NSEC_PLACEHOLDER = "__NSEC_PLACEHOLDER__";

// --- Helper to check project configuration status ---
async function checkProjectConfigStatus(projectPath: string): Promise<boolean> {
    const agentsConfigFile = path.join(projectPath, ".tenex", "agents.json");
    
    try {
        const fileContent = await readFile(agentsConfigFile, "utf-8");
        const agents = JSON.parse(fileContent);
        // Check if there's at least one agent (preferably 'default')
        if (agents && typeof agents === "object" && Object.keys(agents).length > 0) {
            // Verify at least one valid nsec
            const hasValidAgent = Object.values(agents).some(
                (nsec) => typeof nsec === "string" && nsec.length > 0 && nsec.startsWith("nsec")
            );
            if (hasValidAgent) {
                return true; // Valid agents.json exists
            }
        }
        return false; // Invalid structure or no valid agents
    } catch (error: unknown) {
        // Check if it's an error object with a 'code' property
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            return false; // File doesn't exist
        }
        console.error(`Error reading or parsing agents config:`, error);
        return false;
    }
}

// --- GET Handler (Updated to use slug) ---
export async function GET(
    request: NextRequest,
    { params }: { params: { slug: string } }, // Changed id to slug
) {
    const projectSlug = params.slug; // Changed projectId to projectSlug
    if (!projectSlug) {
        return NextResponse.json({ error: "Project slug is required" }, { status: 400 }); // Updated error message
    }

    let projectPath: string;
    try {
        projectPath = getProjectPath(projectSlug); // Use projectSlug
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Server configuration error";
        console.error("Error getting project path:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }

    try {
        await access(projectPath, fs.constants.F_OK); // Use promises version
        const isConfigured = await checkProjectConfigStatus(projectPath);
        return NextResponse.json({ exists: true, configured: isConfigured }, { status: 200 });
    } catch (error: unknown) {
        // Check if it's an error object with a 'code' property
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
            return NextResponse.json({ exists: false, configured: false }, { status: 404 });
        }
        console.error(`Error checking project directory ${projectPath}:`, error);
        return NextResponse.json({ error: "Failed to check project directory" }, { status: 500 });
    }
}

// --- POST Handler (Updated to use slug) ---
export async function POST(
    request: NextRequest,
    { params }: { params: { slug: string } }, // Changed id to slug
) {
    const projectSlug = params.slug; // Changed projectId to projectSlug
    let description = ""; // Default description
    let nsec: string | undefined; // Optional for Claude Code backend
    let repoUrl: string | undefined;
    let projectNaddr: string | undefined; // Added for the project event ID
    let title: string; // Added for the project title
    let hashtags: string | undefined; // Added for hashtags
    let template: string | undefined; // Added for template naddr

    // 1. Validate Project Slug
    if (!projectSlug) {
        return NextResponse.json({ error: "Project slug is required" }, { status: 400 }); // Updated error message
    }

    // 2. Parse Request Body
    try {
        if (request.headers.get("content-type")?.includes("application/json")) {
            const body = await request.json();
            // Title is REQUIRED
            if (body.title && typeof body.title === "string" && body.title.trim() !== "") {
                title = body.title;
            } else {
                return NextResponse.json({ error: "title is required in the request body" }, { status: 400 });
            }
            // NSEC is REQUIRED
            if (body.nsec && typeof body.nsec === "string" && body.nsec.trim() !== "") {
                nsec = body.nsec;
            } else {
                return NextResponse.json({ error: "nsec is required" }, { status: 400 });
            }
            // Description is optional
            if (typeof body.description === "string" && body.description.trim() !== "") {
                description = body.description;
            } else {
                // Use a default description if not provided
                description = `Project specification for ${projectSlug}`; // Use projectSlug
            }
            // Git Repo URL is optional
            if (body.repo && typeof body.repo === "string" && body.repo.trim() !== "") {
                repoUrl = body.repo;
            }
            // Hashtags are optional (expecting comma-separated string)
            if (body.hashtags && typeof body.hashtags === "string" && body.hashtags.trim() !== "") {
                hashtags = body.hashtags;
            }
            // Project naddr is REQUIRED
            if (body.projectNaddr && typeof body.projectNaddr === "string" && body.projectNaddr.trim() !== "") {
                projectNaddr = body.projectNaddr;
            } else {
                // If projectNaddr is missing or invalid, return an error immediately
                return NextResponse.json({ error: "projectNaddr is required in the request body" }, { status: 400 });
            }
            // Template naddr is optional
            if (body.template && typeof body.template === "string" && body.template.trim() !== "") {
                template = body.template;
            }
        } else {
            return NextResponse.json({ error: "Request body must be JSON" }, { status: 415 });
        }
    } catch (e: unknown) {
        console.error("Error parsing request body:", e);
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // --- Execute the tenex CLI command ---
    try {
        // Get backend command from request headers or use default
        const backendCommand = request.headers.get("x-backend-command") || "npx tenex";

        // Get projects path from environment
        const projectsPath = process.env.PROJECTS_PATH;
        if (!projectsPath) {
            return NextResponse.json({ error: "Server configuration error: PROJECTS_PATH not set" }, { status: 500 });
        }

        // Build command arguments safely
        const commandArgs = [
            backendCommand,
            "project",
            "init",
            `"${projectsPath.replace(/"/g, '\\"')}"`,
            "--name",
            `"${projectSlug.replace(/"/g, '\\"')}"`,
            "--nsec",
            `"${nsec!.replace(/"/g, '\\"')}"`, // nsec is required
            "--title",
            `"${title.replace(/"/g, '\\"')}"`,
            "--description",
            `"${description.replace(/"/g, '\\"')}"`,
        ];

        if (projectNaddr) {
            commandArgs.push("--project-naddr", `"${projectNaddr.replace(/"/g, '\\"')}"`);
        }
        if (repoUrl) {
            commandArgs.push("--repo-url", `"${repoUrl.replace(/"/g, '\\"')}"`);
        }
        if (hashtags) {
            commandArgs.push("--hashtags", `"${hashtags.replace(/"/g, '\\"')}"`);
        }
        if (template) {
            commandArgs.push("--template", `"${template.replace(/"/g, '\\"')}"`);
        }

        const command = commandArgs.join(" ");

        // Log template usage for analytics
        if (template) {
            console.log(`Project creation using template: ${template}`);
        }

        console.log(`Executing CLI command: ${command}`);
        const { stdout, stderr } = await execAsync(command);

        // Process stdout: Look for the JSON output line
        const outputLines = stdout.trim().split("\n");
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
            console.log(`CLI executed successfully for project ${projectSlug}:`, scriptResult);
            return NextResponse.json(
                {
                    message: "Project created successfully.",
                    projectSlug: projectSlug,
                    path: scriptResult.projectPath,
                    configured: scriptResult.configured || true,
                },
                { status: 201 },
            );
        } else if (scriptResult && !scriptResult.success) {
            // Handle specific errors reported by the script (via JSON output)
            console.error(`Script reported failure for project ${projectSlug}:`, scriptResult.error); // Use projectSlug
            console.error("Full stdout:", stdout);
            console.error("Full stderr:", stderr);
            if (scriptResult.code === "CONFLICT") {
                // Check config status for existing project before returning conflict
                let projectPathCheck: string;
                try {
                    projectPathCheck = getProjectPath(projectSlug); // Use projectSlug
                    const isConfigured = await checkProjectConfigStatus(projectPathCheck);
                    return NextResponse.json(
                        {
                            message: scriptResult.error || "Project directory already exists.",
                            configured: isConfigured,
                        },
                        { status: 409 },
                    );
                } catch (pathError: unknown) {
                    console.error("Error getting project path during conflict check:", pathError);
                    // Fallback to generic conflict if path fails
                    return NextResponse.json(
                        { error: scriptResult.error || "Project directory already exists." },
                        { status: 409 },
                    );
                }
            }
            // Generic script error reported via JSON
            return NextResponse.json(
                { error: `Project creation script failed: ${scriptResult.error || "Unknown error"}` },
                { status: 500 },
            );
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
        const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
        const stdout = typeof error === "object" && error !== null && "stdout" in error ? String(error.stdout) : ""; // Include stdout for context

        // Attempt to parse the last line of stderr for a JSON error message
        const errorLines = stderr.trim().split("\n");
        let scriptErrorResult = null;
        if (errorLines.length > 0) {
            try {
                scriptErrorResult = JSON.parse(errorLines[errorLines.length - 1]);
            } catch (e) {
                /* Ignore parse error */
            }
        }

        if (scriptErrorResult && !scriptErrorResult.success && scriptErrorResult.error) {
            // Handle specific errors reported by the script (via stderr JSON)
            if (scriptErrorResult.code === "CONFLICT") {
                // Check config status for existing project before returning conflict
                let projectPathCheck: string;
                try {
                    projectPathCheck = getProjectPath(projectSlug); // Use projectSlug
                    const isConfigured = await checkProjectConfigStatus(projectPathCheck);
                    return NextResponse.json(
                        {
                            message: scriptErrorResult.error || "Project directory already exists.",
                            configured: isConfigured,
                        },
                        { status: 409 },
                    );
                } catch (pathError: unknown) {
                    console.error("Error getting project path during conflict check:", pathError);
                    // Fallback to generic conflict if path fails
                    return NextResponse.json(
                        { error: scriptErrorResult.error || "Project directory already exists." },
                        { status: 409 },
                    );
                }
            }
            // Return specific error from script (stderr JSON)
            return NextResponse.json(
                { error: `Project creation script failed: ${scriptErrorResult.error}` },
                { status: 500 },
            );
        }

        // Generic execution error (non-zero exit without specific JSON error)
        return NextResponse.json(
            {
                error: `Failed to execute project creation script: ${error instanceof Error ? error.message : String(error)}`,
                stderr: stderr,
                stdout: stdout, // Include stdout for debugging context
            },
            { status: 500 },
        );
    }
}
