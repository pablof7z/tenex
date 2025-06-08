import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { getProjectPath } from "@/lib/projectUtils"; // Assuming this utility exists and works
import { type NextRequest, NextResponse } from "next/server";

const execAsync = promisify(exec);

// Get the base path from environment variable for security check
const PROJECTS_PATH = process.env.PROJECTS_PATH;

if (!PROJECTS_PATH) {
    console.error("FATAL: PROJECTS_PATH environment variable is not set.");
    // We'll handle this more gracefully within the request if needed
}

interface RequestBody {
    title?: string;
    description?: string;
    context?: string; // Array of strings for additional context
    clinePrompt?: string; // Optional override for the Cline prompt
}

export async function POST(
    request: NextRequest,
    { params }: { params: { slug: string; taskId: string } }, // Changed id to slug
) {
    const projectSlug = params.slug; // Changed projectId to projectSlug
    const taskId = params.taskId;

    if (!projectSlug || !taskId) {
        return NextResponse.json({ error: "Project slug and Task ID are required" }, { status: 400 }); // Updated error message
    }

    let body: RequestBody;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { title = "Untitled Task", description = "", context = "", clinePrompt: customClinePrompt } = body;

    let projectDirPath: string;
    try {
        projectDirPath = getProjectPath(projectSlug); // Use projectSlug
    } catch (error: unknown) {
        // Changed any to unknown
        const message = error instanceof Error ? error.message : "Unknown error getting project path";
        console.error(`Error getting project path for slug ${projectSlug}: ${message}`); // Use projectSlug
        if (message.includes("PROJECTS_PATH")) {
            return NextResponse.json({ error: "Server configuration error: PROJECTS_PATH not set." }, { status: 500 });
        }
        return NextResponse.json({ error: `Failed to determine project path: ${message}` }, { status: 400 });
    }

    console.log(
        `Received request to start work on task ${taskId} for project ${projectSlug} at path: ${projectDirPath}`,
    ); // Use projectSlug

    // --- Security Check ---
    if (!PROJECTS_PATH) {
        console.error("FATAL: PROJECTS_PATH environment variable is not set for security check.");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const allowedBaseDir = path.resolve(PROJECTS_PATH);
    if (!path.resolve(projectDirPath).startsWith(allowedBaseDir)) {
        console.error(`Security Error: Attempted path traversal: ${projectDirPath} is outside ${allowedBaseDir}`);
        return NextResponse.json({ error: "Invalid project path" }, { status: 400 });
    }
    // --- End Security Check ---

    // Get backend command from request headers or use default
    const backendCommand = request.headers.get("x-backend-command") || "npx tenex";

    // Build CLI command
    const commandArgs = [
        backendCommand,
        "run",
        "--roo", // Currently only supporting roo backend
        "--project-path",
        `"${projectDirPath.replace(/"/g, '\\"')}"`,
        "--task-id",
        `"${taskId.replace(/"/g, '\\"')}"`,
        "--task-title",
        `"${title.replace(/"/g, '\\"')}"`,
        "--task-description",
        `"${description.replace(/"/g, '\\"')}"`,
    ];

    // Add context if provided
    if (context && context.length > 0) {
        const contextText = `When you start working, and as you make any progress, publish updates to nostr.\n\n${context}`;
        commandArgs.push("--context", `"${contextText.replace(/"/g, '\\"')}"`);
    } else {
        const contextText = `When you start working, and as you make any progress, publish updates to nostr.`;
        commandArgs.push("--context", `"${contextText.replace(/"/g, '\\"')}"`);
    }

    const command = commandArgs.join(" ");

    console.log(`Executing CLI command: ${command}`);

    try {
        // Execute the CLI command asynchronously (don't await)
        execAsync(command).then(
            ({ stdout, stderr }) => {
                if (stdout) console.log(`tenex run stdout: ${stdout}`);
                if (stderr) console.warn(`tenex run stderr: ${stderr}`);
            },
            (error) => {
                console.error(`Error executing tenex run command: ${error.message}`);
            },
        );

        // Respond immediately
        return NextResponse.json(
            {
                message: `Request received to start work on task ${taskId} for project ${projectSlug}.`,
                projectPath: projectDirPath,
                taskId: taskId,
            },
            { status: 202 },
        ); // 202 Accepted
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error executing command";
        console.error(`Error starting task work: ${message}`);
        return NextResponse.json({ error: `Failed to start task work: ${message}` }, { status: 500 });
    }
}
