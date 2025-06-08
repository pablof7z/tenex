import fs from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

const PROJECTS_DIR = process.env.PROJECTS_PATH;
const TENEX_DIR = ".tenex";
const METADATA_FILE = "metadata.json";

interface UpdateNaddrRequest {
    projectNaddr: string;
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
    try {
        if (!PROJECTS_DIR) {
            return NextResponse.json({ message: "Server configuration error: PROJECTS_PATH not set" }, { status: 500 });
        }

        const { slug } = params;
        const body = (await request.json()) as UpdateNaddrRequest;

        if (!body.projectNaddr) {
            return NextResponse.json({ message: "projectNaddr is required" }, { status: 400 });
        }

        // Validate naddr format (basic check)
        if (!body.projectNaddr.startsWith("naddr1")) {
            return NextResponse.json({ message: "Invalid naddr format" }, { status: 400 });
        }

        // Find the project directory
        const projectDirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
        let projectPath: string | null = null;

        for (const dirent of projectDirs) {
            if (dirent.isDirectory()) {
                const tenexPath = path.join(PROJECTS_DIR, dirent.name, TENEX_DIR);
                const metadataPath = path.join(tenexPath, METADATA_FILE);

                try {
                    const metadataContent = await fs.readFile(metadataPath, "utf-8");
                    const metadata = JSON.parse(metadataContent);

                    // Check if this is the project we're looking for
                    // Match by slug (directory name) or existing projectNaddr
                    if (
                        dirent.name === slug ||
                        (metadata.projectNaddr && metadata.projectNaddr.split(":")[2] === slug)
                    ) {
                        projectPath = path.join(PROJECTS_DIR, dirent.name);
                        break;
                    }
                } catch (error) {
                    // If no metadata file or invalid JSON, check by directory name
                    if (dirent.name === slug) {
                        projectPath = path.join(PROJECTS_DIR, dirent.name);
                        break;
                    }
                }
            }
        }

        if (!projectPath) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        // Update the metadata file
        const metadataPath = path.join(projectPath, TENEX_DIR, METADATA_FILE);
        let metadata: Record<string, unknown> = {};

        try {
            const existingContent = await fs.readFile(metadataPath, "utf-8");
            metadata = JSON.parse(existingContent);
        } catch (error) {
            // If file doesn't exist or is invalid, start with empty object
            console.log("Creating new metadata file or fixing invalid JSON");
        }

        // Update the projectNaddr field
        metadata.projectNaddr = body.projectNaddr;

        // Write the updated metadata
        await fs.mkdir(path.join(projectPath, TENEX_DIR), { recursive: true });
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 4), "utf-8");

        return NextResponse.json({
            message: "Project metadata updated successfully",
            projectNaddr: body.projectNaddr,
        });
    } catch (error) {
        console.error("Failed to update project metadata:", error);
        return NextResponse.json({ message: "Failed to update project metadata" }, { status: 500 });
    }
}
