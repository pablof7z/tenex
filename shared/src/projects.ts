import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { NDKPrivateKeySigner, NDKEvent, NDKArticle } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { logError, logInfo, logSuccess, logWarning } from "./logger.js";
import { getNDK } from "./nostr.js";

const execAsync = promisify(exec);

export interface ProjectInitOptions {
    path: string;
    naddr: string;
}

export interface ProjectInfo {
    name: string;
    path: string;
    exists: boolean;
}

export function extractProjectIdentifierFromTag(aTag: string): string {
    const parts = aTag.split(":");
    return parts[parts.length - 1];
}

export async function checkProjectExists(projectsPath: string, projectIdentifier: string): Promise<ProjectInfo> {
    const sanitizedName = projectIdentifier;
    console.log({projectsPath, projectIdentifier});
    const projectPath = path.join(projectsPath, sanitizedName);
    const tenexDir = path.join(projectPath, ".tenex");

    console.log(`Checking if project exists at: ${projectPath}`);
    
    let exists = false;
    try {
        await access(tenexDir);
        exists = true;
    } catch (err: any) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }

    return {
        name: sanitizedName,
        path: projectPath,
        exists
    };
}

export async function initializeProject(options: ProjectInitOptions): Promise<string> {
    const { path: projectsDir, naddr } = options;

    let projectEvent: NDKArticle;
    let projectName: string;
    let projectTitle: string;
    let projectDescription: string;
    let repoUrl: string | undefined;
    let nsec: string;
    let template: string | undefined;
    let signer: NDKPrivateKeySigner;
    
    try {
        logInfo(`Fetching project from Nostr: ${naddr}`);
        const ndk = await getNDK();
        
        const decoded = nip19.decode(naddr);
        if (decoded.type !== 'naddr') {
            throw new Error('Invalid project naddr');
        }
        const addressPointer = decoded.data as { kind: number; pubkey: string; identifier: string };
        if (addressPointer.kind !== 31933) {
            throw new Error('Invalid project kind, expected 31933');
        }
        
        const filter = {
            kinds: [31933],
            authors: [addressPointer.pubkey],
            "#d": [addressPointer.identifier]
        };
        
        const projectEvents = await ndk.fetchEvents(filter);
        projectEvent = Array.from(projectEvents)[0] as NDKArticle;
        
        if (!projectEvent) {
            throw new Error('Project not found');
        }
        
        projectName = addressPointer.identifier;
        
        // Try to get title from NDKArticle property first, then from tags
        if (projectEvent.title) {
            projectTitle = projectEvent.title;
        } else {
            // Fallback: look for title in tags
            const titleTag = projectEvent.tags.find(tag => tag[0] === 'title');
            projectTitle = titleTag ? titleTag[1] : projectName;
        }
        
        projectDescription = projectEvent.content || `Project ${projectName}`;
        
        const repoTag = projectEvent.tags.find(tag => tag[0] === 'repo');
        if (repoTag && repoTag[1]) {
            repoUrl = repoTag[1];
            logSuccess(`Found project repository: ${repoUrl}`);
        }
        
        // Generate new nsec for project
        signer = NDKPrivateKeySigner.generate();
        nsec = (signer as any).nsec;
        logInfo('Generated new nsec for project');
        
        const templateTag = projectEvent.tags.find(tag => tag[0] === 'template');
        if (templateTag && templateTag[1]) {
            template = templateTag[1];
            logInfo(`Found template reference: ${template}`);
            
            if (!repoUrl) {
                try {
                    logInfo(`Fetching template from Nostr: ${template}`);
                    
                    const templateDecoded = nip19.decode(template);
                    if (templateDecoded.type !== 'naddr') {
                        throw new Error('Invalid template naddr');
                    }
                    const templatePointer = templateDecoded.data as { kind: number; pubkey: string; identifier: string };
                    
                    const templateFilter = {
                        kinds: [templatePointer.kind],
                        authors: [templatePointer.pubkey],
                        "#d": [templatePointer.identifier]
                    };
                    
                    const templateEvents = await ndk.fetchEvents(templateFilter);
                    const templateEvent = Array.from(templateEvents)[0];
                    
                    if (templateEvent) {
                        const uriTag = templateEvent.tags.find(tag => tag[0] === 'uri');
                        const templateRepoTag = templateEvent.tags.find(tag => tag[0] === 'repo');
                        
                        if (uriTag && uriTag[1]) {
                            repoUrl = uriTag[1].replace('git+', '');
                            logSuccess(`Found template repository: ${repoUrl}`);
                        } else if (templateRepoTag && templateRepoTag[1]) {
                            repoUrl = templateRepoTag[1];
                            logSuccess(`Found template repository: ${repoUrl}`);
                        }
                    }
                } catch (templateErr: any) {
                    logWarning(`Failed to fetch template: ${templateErr.message}`);
                }
            }
        }
        
        logSuccess(`Loaded project: ${projectTitle}`);
    } catch (err: any) {
        logError(`Failed to fetch project: ${err.message}`);
        throw err;
    }

    const projectPath = path.join(projectsDir, projectName.replace(/[^a-zA-Z0-9-_]/g, "-"));
    const tenexDir = path.join(projectPath, ".tenex");
    const agentsConfigPath = path.join(tenexDir, "agents.json");

    try {
        let projectExists = false;
        try {
            await access(projectPath);
            projectExists = true;
            logInfo(`Using existing project directory: ${projectPath}`);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err;
        }

        if (!projectExists) {
            logInfo(`Creating project directory: ${projectPath}`);
            await mkdir(projectPath, { recursive: true });
        }

        if (repoUrl && !projectExists) {
            logInfo(`Cloning repository from ${repoUrl}...`);
            try {
                await execAsync(`git clone --depth 1 "${repoUrl}" "${projectPath}"`);
                logSuccess("Repository cloned successfully");
            } catch (err: any) {
                const errorMessage = err.stderr || err.message || "Unknown error during clone";
                logError(`Failed to clone repository: ${errorMessage}`);
                await execAsync(`rm -rf "${projectPath}"`);
                throw err;
            }
        } else if (repoUrl && projectExists) {
            logWarning("Repository URL provided but project directory already exists. Skipping clone.");
        } else if (!projectExists) {
            logInfo("Initializing empty git repository...");
            await execAsync(`cd "${projectPath}" && git init`);
        } else {
            try {
                await execAsync(`cd "${projectPath}" && git status`);
                logInfo("Existing git repository detected");
            } catch {
                logInfo("Initializing git repository in existing directory...");
                await execAsync(`cd "${projectPath}" && git init`);
            }
        }

        // Check if .tenex already exists (e.g., from cloned template)
        let tenexExists = false;
        try {
            await access(tenexDir);
            tenexExists = true;
            logInfo(`.tenex directory found from template. Updating configuration...`);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err;
        }

        if (!tenexExists) {
            logInfo("Creating .tenex directory structure...");
            await mkdir(tenexDir, { recursive: true });
        }

        const agentsConfig = {
            default: {
                nsec: nsec,
                name: `default @ ${projectTitle}`,
                model: "claude-3-5-sonnet-20241022"
            }
        };

        let projectRepoUrl = null;
        try {
            const { stdout } = await execAsync(`cd "${projectPath}" && git config --get remote.origin.url`);
            projectRepoUrl = stdout.trim();
        } catch {
            // No remote origin set yet, that's fine
        }

        const projectMetadata = {
            title: projectTitle,
            description: projectDescription,
            repoUrl: projectRepoUrl,
            projectNaddr: naddr,
            template: template || null
        };

        await writeFile(agentsConfigPath, JSON.stringify(agentsConfig, null, 2));
        logSuccess(`Created ${agentsConfigPath}`);

        // Publish kind:0 profile for default agent
        try {
            const defaultAgent = agentsConfig.default;
            const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(defaultAgent.name)}`;
            const ndk = await getNDK();
            
            const profileEvent = new NDKEvent(ndk, {
                kind: 0,
                pubkey: signer.pubkey,
                content: JSON.stringify({
                    name: defaultAgent.name,
                    display_name: defaultAgent.name,
                    about: `Default AI agent for ${projectTitle} project powered by ${defaultAgent.model}`,
                    picture: avatarUrl,
                    created_at: Math.floor(Date.now() / 1000)
                }),
                tags: []
            });
            
            await profileEvent.sign(signer);
            await profileEvent.publish();
            
            logSuccess(`Published kind:0 profile for default agent with avatar`);
        } catch (err: any) {
            logWarning(`Failed to publish kind:0 profile for default agent: ${err.message}`);
            // Continue even if profile publish fails
        }

        const metadataPath = path.join(tenexDir, "metadata.json");
        await writeFile(metadataPath, JSON.stringify(projectMetadata, null, 2));
        logSuccess(`Created ${metadataPath}`);

        const contextDir = path.join(projectPath, "context");
        await mkdir(contextDir, { recursive: true });

        const specPath = path.join(contextDir, "SPEC.md");
        const specContent = `# Project Specification: ${projectTitle}

${projectDescription}

## Overview

[Add project overview here]

## Requirements

[Add project requirements here]

## Architecture

[Add architecture details here]
`;
        await writeFile(specPath, specContent);
        logSuccess(`Created ${specPath}`);

        if (!repoUrl) {
            const readmePath = path.join(projectPath, "README.md");
            await writeFile(readmePath, `# ${projectTitle}\n\n${projectDescription}`);
        }

        logSuccess(`Project "${projectName}" created successfully at ${projectPath}`);
        return projectPath;
        
    } catch (err: any) {
        logError(`Failed to create project: ${err.message}`);
        throw err;
    }
}