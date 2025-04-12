import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getProjectContextPath, getProjectRulesPath } from "@/lib/projectUtils"; // Import both utility functions

// Interface for file data
interface SpecFile {
    name: string;
    content: string;
}

// Helper function to read files from a directory
async function readFilesFromDir(dirPath: string): Promise<SpecFile[]> {
    console.log(`Attempting to read files from: ${dirPath}`);
    let fileNames: string[];
    try {
        fileNames = await fs.readdir(dirPath);
    } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT") {
            console.log(`Directory not found, creating: ${dirPath}`);
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Directory created: ${dirPath}`);
            return []; // Return empty array as the directory was just created
        }
        console.error(`Error reading directory ${dirPath}:`, err);
        const message = err instanceof Error ? err.message : "Unknown error reading directory";
        throw new Error(`Failed to read directory: ${message}`); // Re-throw to be caught by the main handler
    }

    if (fileNames.length === 0) {
        console.log(`No files found in directory: ${dirPath}`);
        return [];
    }

    const filesData = await Promise.all(
        fileNames
            .filter((fileName) => !fileName.startsWith(".")) // Ignore hidden files
            .map(async (fileName) => {
                const filePath = path.join(dirPath, fileName);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isFile()) {
                        const content = await fs.readFile(filePath, "utf-8");
                        return { name: fileName, content };
                    }
                    console.log(`Skipping non-file item: ${fileName} in ${dirPath}`);
                    return null; // Skip directories or other non-files
                } catch (readErr: unknown) {
                    console.error(`Error reading or stating file ${filePath}:`, readErr);
                    return null; // Skip file on error
                }
            }),
    );

    // Filter out null values (skipped items or files with read errors)
    const validFiles = filesData.filter((file): file is SpecFile => file !== null);
    console.log(`Successfully read ${validFiles.length} files from ${dirPath}.`);
    return validFiles;
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
    const projectId = params.id;
    if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    try {
        const projectContextDir = getProjectContextPath(projectId);
        const projectRulesDir = getProjectRulesPath(projectId); // Get rules path

        // Read files from both directories concurrently
        const [specFiles, ruleFiles] = await Promise.all([
            readFilesFromDir(projectContextDir),
            readFilesFromDir(projectRulesDir)
        ]);

        console.log(`Fetched ${specFiles.length} spec files and ${ruleFiles.length} rule files for project ${projectId}.`);

        // Return grouped files
        return NextResponse.json({
            specs: specFiles,
            rules: ruleFiles
        });

    } catch (error: unknown) {
        console.error(`Failed to get project files for ${projectId}:`, error);
        const message = error instanceof Error ? error.message : "Failed to get project files";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    const projectId = params.id;
    if (!projectId) {
        return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    let fileName: string | undefined;
    let content: string | undefined;
    let group: 'specs' | 'rules' | undefined; // Add group parameter

    try {
        // Expect fileName, content, and group in the body
        ({ fileName, content, group } = await request.json());

        if (typeof fileName !== "string" || !fileName) {
            return NextResponse.json({ error: "fileName must be a non-empty string" }, { status: 400 });
        }
        if (fileName.includes("/") || fileName.includes("..")) {
            return NextResponse.json({ error: "Invalid fileName (contains '/' or '..')" }, { status: 400 });
        }
        if (typeof content !== "string") {
            // Allow empty string for content when creating new files initially
            return NextResponse.json({ error: "File content must be a string" }, { status: 400 });
        }
        if (group !== 'specs' && group !== 'rules') {
            return NextResponse.json({ error: "Invalid or missing 'group' parameter (must be 'specs' or 'rules')" }, { status: 400 });
        }

        // Determine the target directory based on the group
        const targetDirectory = group === 'specs'
            ? getProjectContextPath(projectId)
            : getProjectRulesPath(projectId);

        const targetFilePath = path.join(targetDirectory, fileName);

        console.log(`Attempting to write ${group} file to: ${targetFilePath}`);

        // Ensure the target directory exists, creating it if necessary
        await fs.mkdir(targetDirectory, { recursive: true });
        console.log(`Ensured ${group} directory exists: ${targetDirectory}`);

        // Write the content to the target file
        await fs.writeFile(targetFilePath, content);

        console.log(`Successfully updated ${group} file: ${targetFilePath}`);
        return NextResponse.json({ message: `${fileName} (${group}) updated successfully` });

    } catch (error: unknown) {
        const errorContext = fileName ? `${group || 'unknown group'} file ${fileName}` : `${group || 'unknown group'} file`;
        console.error(`Failed to update ${errorContext} for ${projectId}:`, error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
        }
        const message = error instanceof Error ? error.message : `Failed to update ${errorContext}`;
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
