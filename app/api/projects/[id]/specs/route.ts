import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getProjectContextPath } from "@/lib/projectUtils"; // Import the new utility function

export async function GET(request: Request, { params }: { params: { id: string } }) {
    const projectId = params.id;
    if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    try {
        // Use the utility function to get the project's context directory path
        const projectContextDir = getProjectContextPath(projectId);

        console.log(`Attempting to read spec files from: ${projectContextDir}`);

        let fileNames: string[];
        try {
            fileNames = await fs.readdir(projectContextDir);
        } catch (err: unknown) {
            // Check if it's a Node.js filesystem error with a 'code' property
            if (typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT") {
                console.log(`Context directory not found for project ${projectId}, creating: ${projectContextDir}`);
                // Create the directory if it doesn't exist
                await fs.mkdir(projectContextDir, { recursive: true });
                console.log(`Context directory created: ${projectContextDir}`);
                // Return empty files array as the directory was just created
                return NextResponse.json({ files: [] });
            }
            // Other errors during readdir should be reported
            console.error(`Error reading context directory ${projectContextDir}:`, err);
            const message = err instanceof Error ? err.message : "Unknown error reading context directory";
            throw new Error(`Failed to read context directory: ${message}`);
        }

        if (fileNames.length === 0) {
            console.log(`No files found in context directory: ${projectContextDir}`);
            return NextResponse.json({ files: [] });
        }

        const specFiles = await Promise.all(
            fileNames
                .filter((fileName) => !fileName.startsWith(".")) // Ignore hidden files
                .map(async (fileName) => {
                    const filePath = path.join(projectContextDir, fileName);
                    try {
                        const stats = await fs.stat(filePath);
                        // Ensure it's a file, not a directory
                        if (stats.isFile()) {
                            const content = await fs.readFile(filePath, "utf-8");
                            return { name: fileName, content };
                        }
                        console.log(`Skipping directory: ${fileName}`);
                        return null; // Skip directories
                    } catch (readErr: unknown) {
                        console.error(`Error reading file ${filePath}:`, readErr);
                        // Optionally skip files that can't be read, or throw an error
                        return null; // Skip file on error
                    }
                }),
        );

        // Filter out null values (skipped directories or files with read errors)
        const validSpecFiles = specFiles.filter((file) => file !== null);

        console.log(`Successfully read ${validSpecFiles.length} spec files for project ${projectId}.`);
        return NextResponse.json({ files: validSpecFiles });
    } catch (error: unknown) {
        console.error(`Failed to get project specs for ${projectId}:`, error);
        const message = error instanceof Error ? error.message : "Failed to get project specs";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const projectId = params.id;
    if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    let fileName: string | undefined; // Declare fileName outside try
    let content: string | undefined; // Declare content outside try
    try {
        // Expect fileName and content in the body
        ({ fileName, content } = await request.json());

        if (typeof fileName !== "string" || !fileName) {
            return NextResponse.json({ error: "fileName must be a non-empty string" }, { status: 400 });
        }
        // Basic path traversal check (can be enhanced)
        if (fileName.includes("/") || fileName.includes("..")) {
            return NextResponse.json({ error: "Invalid fileName" }, { status: 400 });
        }
        if (typeof content !== "string") {
            return NextResponse.json({ error: "Spec content must be a string" }, { status: 400 });
        }

        const projectContextDir = getProjectContextPath(projectId);
        // Use the provided fileName instead of hardcoding SPEC.md
        const targetFilePath = path.join(projectContextDir, fileName);

        console.log(`Attempting to write spec file to: ${targetFilePath}`);

        // Ensure the context directory exists, creating it if necessary
        await fs.mkdir(projectContextDir, { recursive: true });
        console.log(`Ensured context directory exists: ${projectContextDir}`);

        // Write the new content to the target file
        await fs.writeFile(targetFilePath, content);

        console.log(`Successfully updated spec file: ${targetFilePath}`);
        // Use fileName in the success message
        return NextResponse.json({ message: `${fileName} updated successfully` });
    } catch (error: unknown) {
        // Use fileName in the error message if available, otherwise use a generic message
        const errorContext = fileName ? `spec file ${fileName}` : "spec file"; // Check if fileName was successfully parsed
        console.error(`Failed to update ${errorContext} for ${projectId}:`, error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }
        const message = error instanceof Error ? error.message : `Failed to update ${errorContext}`;
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
