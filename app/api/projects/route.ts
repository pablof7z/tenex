import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import ndk from "@/lib/nostr/ndk"; // Import the singleton NDK instance
import { NDKProject } from "@/lib/nostr/events/project";

// Read the environment variable directly
const PROJECTS_DIR = process.env.PROJECTS_PATH;
const TENEX_CONFIG_FILE = ".tenex.json";

export interface ProjectConfig {
    pubkey: string;
    nsec: string;
    hashtags?: string[];
    repoUrl?: string;
    eventId?: string;
    slug?: string;
}

export async function GET() {
    try {
        // Check if PROJECTS_DIR is defined
        if (!PROJECTS_DIR) {
            // This check should ideally be redundant if the server startup check in projectUtils works,
            // but it's good practice to handle it here too.
            console.error("API Error: PROJECTS_PATH environment variable is not set.");
            return NextResponse.json({ message: "Server configuration error: PROJECTS_PATH not set" }, { status: 500 });
        }
        const projectDirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
        const projectConfigs: ProjectConfig[] = [];
        const projectNames: string[] = [];

        for (const dirent of projectDirs) {
            console.log(dirent);
            if (dirent.isDirectory()) {
                const projectPath = path.join(PROJECTS_DIR, dirent.name);
                const configPath = path.join(projectPath, TENEX_CONFIG_FILE);

                try {
                    const configFileContent = await fs.readFile(configPath, "utf-8");
                    const configJson = JSON.parse(configFileContent) as ProjectConfig;
                    const eventId = configJson.eventId;
                    const slug = eventId ? eventId.split(/:/)[2] : dirent.name;

                    projectConfigs.push({
                        ...configJson,
                        slug,
                    });
                    
                    // Store the project name (directory name) which acts as the dTag
                    projectNames.push(dirent.name);
                } catch (error: unknown) {
                    // If .tenex.json doesn't exist or is invalid, skip this project
                    // Type guard for file system errors
                    if (
                        error instanceof Error &&
                        "code" in error &&
                        error.code !== "ENOENT" &&
                        !(error instanceof SyntaxError)
                    ) {
                        console.error(`Error processing project ${dirent.name}:`, error);
                        // Decide if you want to return an error or just log and skip
                    } else if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
                        // Add type guard here too
                        console.warn(`Invalid JSON in ${configPath}, skipping.`);
                    }
                    // If ENOENT, just means no .tenex.json, which is fine, we skip.
                }
            }
        }

        if (projectNames.length === 0) {
            return NextResponse.json([]); // Return empty if no projects found locally
        }

        return NextResponse.json(projectConfigs);

        // Fetch NDKProject events using the project names as dTags
        const projectEvents = await ndk.fetchEvents([
            {
                kinds: [NDKProject.kind],
                "#d": projectNames,
            },
        ]);

        // Convert Set<NDKEvent> to NDKEvent[] for JSON serialization
        const eventsArray = Array.from(projectEvents).map(e => e.rawEvent())

        return NextResponse.json(eventsArray);
    } catch (error: unknown) {
        console.error("Failed to list projects:", error);
        // Handle case where PROJECTS_DIR itself doesn't exist or other fs errors
        // Type guard for file system errors
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return NextResponse.json({ message: "Projects directory not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
