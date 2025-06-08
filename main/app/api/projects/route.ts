import path from "path";
import { NDKProject } from "@/lib/nostr/events/project";
import ndk from "@/lib/nostr/ndk"; // Import the singleton NDK instance
import fs from "fs/promises";
import { NextResponse } from "next/server";
import { nip19 } from "nostr-tools";

// Read the environment variable directly
const PROJECTS_DIR = process.env.PROJECTS_PATH;
const TENEX_DIR = ".tenex";
const AGENTS_CONFIG_FILE = "agents.json";
const METADATA_FILE = "metadata.json";

export interface AgentsConfig {
    [agentName: string]: string; // Maps agent name to nsec
}

export interface ProjectMetadata {
    name: string;
    title?: string;
    description?: string;
    hashtags?: string[];
    repoUrl?: string;
    projectNaddr?: string;
    templateName?: string;
    templateId?: string;
    createdAt?: string;
}

export interface ProjectConfig {
    nsec: string;
    pubkey: string;
    agents?: AgentsConfig;
    name?: string;
    title?: string;
    description?: string;
    hashtags?: string[];
    repoUrl?: string;
    projectNaddr?: string;
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
                const tenexPath = path.join(projectPath, TENEX_DIR);
                const agentsConfigPath = path.join(tenexPath, AGENTS_CONFIG_FILE);
                const metadataPath = path.join(tenexPath, METADATA_FILE);

                try {
                    let nsec: string;
                    let pubkey: string = "";
                    let agents: AgentsConfig;
                    
                    // Read agents.json
                    const agentsConfigContent = await fs.readFile(agentsConfigPath, "utf-8");
                    agents = JSON.parse(agentsConfigContent) as AgentsConfig;
                    
                    // Use default agent if available, otherwise first agent
                    if (agents.default) {
                        nsec = agents.default;
                    } else {
                        const firstAgent = Object.values(agents)[0];
                        if (firstAgent) {
                            nsec = firstAgent;
                        } else {
                            throw new Error("No agents found in agents.json");
                        }
                    }
                    
                    // Derive pubkey from nsec
                    try {
                        const { NDKPrivateKeySigner } = await import("@nostr-dev-kit/ndk");
                        const signer = new NDKPrivateKeySigner(nsec);
                        pubkey = signer.pubkey;
                    } catch (err) {
                        console.warn(`Failed to derive pubkey for project ${dirent.name}:`, err);
                    }

                    let metadata: Partial<ProjectMetadata> = {};
                    try {
                        const metadataContent = await fs.readFile(metadataPath, "utf-8");
                        metadata = JSON.parse(metadataContent) as ProjectMetadata;
                    } catch (metadataError) {
                        // Metadata is optional, use defaults
                        metadata = { name: dirent.name };
                    }

                    const projectNaddr = metadata.projectNaddr;
                    let slug = dirent.name; // Default to directory name

                    if (projectNaddr) {
                        try {
                            // Decode the naddr to get the identifier (d tag)
                            const decoded = nip19.decode(projectNaddr);
                            if (decoded.type === "naddr" && decoded.data.identifier) {
                                slug = decoded.data.identifier;
                            }
                        } catch (decodeError) {
                            console.warn(`Failed to decode naddr for project ${dirent.name}:`, decodeError);
                            // Fall back to directory name if decode fails
                        }
                    }

                    projectConfigs.push({
                        nsec,
                        pubkey,
                        agents,
                        ...metadata,
                        slug,
                    });

                    // Store the project name (directory name) which acts as the dTag
                    projectNames.push(dirent.name);
                } catch (error: unknown) {
                    // If .tenex/agents.json doesn't exist or is invalid, skip this project
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
                        console.warn(`Invalid configuration in ${tenexPath}, skipping.`);
                    }
                    // If ENOENT, just means no .tenex configuration, which is fine, we skip.
                }
            }
        }

        if (projectNames.length === 0) {
            return NextResponse.json([]); // Return empty if no projects found locally
        }

        return NextResponse.json(projectConfigs);
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
