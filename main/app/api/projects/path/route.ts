import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const filePath = searchParams.get("path");

        if (filePath) {
            // Read a specific file
            const projectsPath = process.env.PROJECTS_PATH || path.join(process.cwd(), "projects");

            // Security check: ensure the path is within the projects directory
            const resolvedPath = path.resolve(filePath);
            const resolvedProjectsPath = path.resolve(projectsPath);

            if (!resolvedPath.startsWith(resolvedProjectsPath)) {
                return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
            }

            if (!fs.existsSync(resolvedPath)) {
                return NextResponse.json({ error: "File not found" }, { status: 404 });
            }

            try {
                const content = fs.readFileSync(resolvedPath, "utf8");
                const data = JSON.parse(content);
                return NextResponse.json(data);
            } catch (error) {
                console.error("Error reading file:", error);
                return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
            }
        } else {
            // Return the projects path
            const projectsPath = process.env.PROJECTS_PATH;

            if (!projectsPath) {
                return NextResponse.json({ error: "PROJECTS_PATH environment variable is not set" }, { status: 500 });
            }

            return NextResponse.json({ projectsPath });
        }
    } catch (error) {
        console.error("Error processing request:", error);
        return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
    }
}
