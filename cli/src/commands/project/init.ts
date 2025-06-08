import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { NDKPrivateKeySigner, NDKEvent } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { logError, logInfo, logSuccess, logWarning } from "../../utils/logger";
import { getNDK } from "../../nostr/ndkClient";

const execAsync = promisify(exec);

interface ProjectInitOptions {
    path: string;
    name: string;
    nsec: string;
    title?: string;
    description?: string;
    repoUrl?: string;
    hashtags?: string;
    projectNaddr?: string;
    template?: string;
}

export async function runProjectInit(options: ProjectInitOptions) {
    let { path: projectsDir, name, nsec, title, description, repoUrl, hashtags, projectNaddr, template } = options;

    // If template naddr is provided, fetch the template and extract the repository URL
    if (template && !repoUrl) {
        try {
            logInfo(`Fetching template from Nostr: ${template}`);
            const ndk = await getNDK();
            
            // Decode the naddr to get the event identifier
            const decoded = nip19.decode(template);
            if (decoded.type !== 'naddr') {
                throw new Error('Invalid template naddr');
            }
            const addressPointer = decoded.data as { kind: number; pubkey: string; identifier: string };
            if (addressPointer.kind !== 30717) {
                throw new Error('Invalid template kind');
            }
            
            // Fetch the template event
            const filter = {
                kinds: [30717],
                authors: [addressPointer.pubkey],
                "#d": [addressPointer.identifier]
            };
            
            const templateEvents = await ndk.fetchEvents(filter);
            const templateEvent = Array.from(templateEvents)[0];
            
            if (!templateEvent) {
                throw new Error('Template not found');
            }
            
            // Extract the repository URL from the uri tag
            const uriTag = templateEvent.tags.find(tag => tag[0] === 'uri');
            if (uriTag && uriTag[1]) {
                repoUrl = uriTag[1].replace('git+', ''); // Remove git+ prefix if present
                logSuccess(`Found template repository: ${repoUrl}`);
            } else {
                throw new Error('Template does not contain a repository URL');
            }
        } catch (err: any) {
            logError(`Failed to fetch template: ${err.message}`);
            process.exit(1);
        }
    }

    const projectPath = path.join(projectsDir, name.replace(/[^a-zA-Z0-9-_]/g, "-"));
    const tenexDir = path.join(projectPath, ".tenex");
    const agentsConfigPath = path.join(tenexDir, "agents.json");

    try {
        // Check if .tenex directory already exists
        try {
            await access(tenexDir);
            logError(`Project already initialized at ${projectPath} (.tenex directory exists)`);
            process.exit(1);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err;
        }

        // Check if project directory exists
        let projectExists = false;
        try {
            await access(projectPath);
            projectExists = true;
            logInfo(`Using existing project directory: ${projectPath}`);
        } catch (err: any) {
            if (err.code !== "ENOENT") throw err;
        }

        // Create project directory if it doesn't exist
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
                process.exit(1);
            }
        } else if (repoUrl && projectExists) {
            logWarning("Repository URL provided but project directory already exists. Skipping clone.");
        } else if (!projectExists) {
            logInfo("Initializing empty git repository...");
            await execAsync(`cd "${projectPath}" && git init`);
        } else {
            // Project exists and no repo URL - check if it's already a git repo
            try {
                await execAsync(`cd "${projectPath}" && git status`);
                logInfo("Existing git repository detected");
            } catch {
                logInfo("Initializing git repository in existing directory...");
                await execAsync(`cd "${projectPath}" && git init`);
            }
        }

        logInfo("Creating .tenex directory structure...");
        await mkdir(tenexDir, { recursive: true });

        // Create agents configuration with default agent
        const agentsConfig = {
            default: nsec
        };

        const projectMetadata = {
            name: name,
            title: title || name,
            description: description || `Project ${name}`,
            hashtags: hashtags ? hashtags.split(",").map((h) => h.trim()).filter(Boolean) : [],
            repoUrl: repoUrl || null,
            projectNaddr: projectNaddr || null,
            template: template || null,
            createdAt: new Date().toISOString(),
        };

        await writeFile(agentsConfigPath, JSON.stringify(agentsConfig, null, 2));
        logSuccess(`Created ${agentsConfigPath}`);

        const metadataPath = path.join(tenexDir, "metadata.json");
        await writeFile(metadataPath, JSON.stringify(projectMetadata, null, 2));
        logSuccess(`Created ${metadataPath}`);

        const contextDir = path.join(projectPath, "context");
        await mkdir(contextDir, { recursive: true });

        const specPath = path.join(contextDir, "SPEC.md");
        const specContent = `# Project Specification: ${title || name}

${description || `This is the specification for ${name}.`}

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
            await writeFile(readmePath, `# ${title || name}\n\n${description || ""}`);
        }

        logSuccess(`\nProject "${name}" created successfully at ${projectPath}`);
        console.log(
            JSON.stringify({
                success: true,
                projectPath: projectPath,
                name: name,
                configured: true,
            })
        );
    } catch (err: any) {
        logError(`Failed to create project: ${err.message}`);
        // Only cleanup if we created the directory and it's not an existing project
        if (!projectExists) {
            try {
                await execAsync(`rm -rf "${projectPath}"`);
            } catch (cleanupErr) {
                logError(`Failed to cleanup: ${cleanupErr}`);
            }
        }
        process.exit(1);
    }
}