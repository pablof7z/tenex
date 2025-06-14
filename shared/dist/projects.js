import { exec } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { fetchAndSaveAgentDefinitions as fetchAgentDefs, publishAgentProfile, toKebabCase, updateAgentConfig, } from "./agents/index.js";
import { logError, logInfo, logSuccess, logWarning } from "./logger.js";
import { getNDK } from "./nostr.js";
import { getErrorMessage } from "@tenex/types/utils";
const execAsync = promisify(exec);
// Re-export utility functions from agents module
export { toKebabCase, updateAgentConfig, } from "./agents/index.js";
export function extractProjectIdentifierFromTag(aTag) {
    const parts = aTag.split(":");
    return parts[parts.length - 1];
}
export async function checkProjectExists(projectsPath, projectIdentifier) {
    const sanitizedName = projectIdentifier;
    console.log({ projectsPath, projectIdentifier });
    const projectPath = path.join(projectsPath, sanitizedName);
    const tenexDir = path.join(projectPath, ".tenex");
    console.log(`Checking if project exists at: ${projectPath}`);
    let exists = false;
    try {
        await access(tenexDir);
        exists = true;
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
            throw err;
        }
    }
    return {
        name: sanitizedName,
        path: projectPath,
        exists,
    };
}
async function fetchProjectFromNostr(naddr) {
    logInfo(`Fetching project from Nostr: ${naddr}`);
    const ndk = await getNDK();
    const decoded = nip19.decode(naddr);
    if (decoded.type !== "naddr") {
        throw new Error("Invalid project naddr");
    }
    const addressPointer = decoded.data;
    if (addressPointer.kind !== 31933) {
        throw new Error("Invalid project kind, expected 31933");
    }
    const filter = {
        kinds: [31933],
        authors: [addressPointer.pubkey],
        "#d": [addressPointer.identifier],
    };
    const projectEvents = await ndk.fetchEvents(filter);
    const projectEvent = Array.from(projectEvents)[0];
    if (!projectEvent) {
        throw new Error("Project not found");
    }
    const projectName = addressPointer.identifier;
    // Extract agent event IDs from tags
    const agentEventIds = projectEvent.tags
        .filter((tag) => tag[0] === "agent" && tag[1])
        .map((tag) => tag[1]);
    // Try to get title from NDKArticle property first, then from tags
    let projectTitle;
    if (projectEvent.title) {
        projectTitle = projectEvent.title;
    }
    else {
        // Fallback: look for title in tags
        const titleTag = projectEvent.tags.find((tag) => tag[0] === "title");
        projectTitle = titleTag ? titleTag[1] : projectName;
    }
    const projectDescription = projectEvent.content || `Project ${projectName}`;
    const repoTag = projectEvent.tags.find((tag) => tag[0] === "repo");
    let repoUrl;
    if (repoTag?.[1]) {
        repoUrl = repoTag[1];
        logSuccess(`Found project repository: ${repoUrl}`);
    }
    const templateTag = projectEvent.tags.find((tag) => tag[0] === "template");
    let template;
    if (templateTag?.[1]) {
        template = templateTag[1];
        logInfo(`Found template reference: ${template}`);
        if (!repoUrl) {
            repoUrl = await fetchTemplateRepoUrl(template);
        }
    }
    logSuccess(`Loaded project: ${projectTitle}`);
    return {
        projectEvent,
        projectName,
        projectTitle,
        projectDescription,
        repoUrl,
        template,
        agentEventIds,
    };
}
async function fetchTemplateRepoUrl(template) {
    try {
        logInfo(`Fetching template from Nostr: ${template}`);
        const ndk = await getNDK();
        const templateDecoded = nip19.decode(template);
        if (templateDecoded.type !== "naddr") {
            throw new Error("Invalid template naddr");
        }
        const templatePointer = templateDecoded.data;
        const templateFilter = {
            kinds: [templatePointer.kind],
            authors: [templatePointer.pubkey],
            "#d": [templatePointer.identifier],
        };
        const templateEvents = await ndk.fetchEvents(templateFilter);
        const templateEvent = Array.from(templateEvents)[0];
        if (templateEvent) {
            const uriTag = templateEvent.tags.find((tag) => tag[0] === "uri");
            const templateRepoTag = templateEvent.tags.find((tag) => tag[0] === "repo");
            if (uriTag?.[1]) {
                const repoUrl = uriTag[1].replace("git+", "");
                logSuccess(`Found template repository: ${repoUrl}`);
                return repoUrl;
            }
            if (templateRepoTag?.[1]) {
                const repoUrl = templateRepoTag[1];
                logSuccess(`Found template repository: ${repoUrl}`);
                return repoUrl;
            }
        }
    }
    catch (templateErr) {
        logWarning(`Failed to fetch template: ${getErrorMessage(templateErr)}`);
    }
    return undefined;
}
export async function initializeProject(options) {
    const { path: projectsDir, naddr } = options;
    let projectData;
    try {
        projectData = await fetchProjectFromNostr(naddr);
    }
    catch (err) {
        logError(`Failed to fetch project: ${getErrorMessage(err)}`);
        throw err;
    }
    // Generate new nsec for project
    const signer = NDKPrivateKeySigner.generate();
    const nsec = signer.nsec;
    logInfo("Generated new nsec for project");
    const projectPath = path.join(projectsDir, projectData.projectName.replace(/[^a-zA-Z0-9-_]/g, "-"));
    const tenexDir = path.join(projectPath, ".tenex");
    const agentsConfigPath = path.join(tenexDir, "agents.json");
    try {
        // Set environment variable to prevent duplicate profile publishing
        process.env.TENEX_PROJECT_INIT = "true";
        // Create project directory and setup git
        await createProjectDirectory(projectPath, projectData.repoUrl);
        // Create .tenex directory structure
        await createTenexDirectory(tenexDir);
        // Initialize agents config - will be populated after fetching agent definitions
        const agentsConfig = {
            default: { nsec },
        };
        // Save project metadata
        const projectRepoUrl = await getGitRemoteUrl(projectPath);
        const projectMetadata = {
            title: projectData.projectTitle,
            description: projectData.projectDescription,
            repoUrl: projectRepoUrl,
            projectNaddr: naddr,
            template: projectData.template || null,
        };
        const metadataPath = path.join(tenexDir, "metadata.json");
        await writeFile(metadataPath, JSON.stringify(projectMetadata, null, 2));
        logSuccess(`Created ${metadataPath}`);
        // Fetch and save agent definitions
        if (projectData.agentEventIds.length > 0) {
            await fetchAgentDefs(projectData.agentEventIds, tenexDir, agentsConfig);
        }
        // Save the complete agents.json with all agents
        const agentsJsonContent = JSON.stringify(agentsConfig, null, 2);
        await writeFile(agentsConfigPath, agentsJsonContent);
        logSuccess(`Created ${agentsConfigPath} with ${Object.keys(agentsConfig).length} agents`);
        // Publish kind:0 profiles for all agents
        await publishAgentProfiles(agentsConfig, projectData.projectTitle);
        // Create initial project files
        await createInitialProjectFiles(projectPath, projectData.projectTitle, projectData.projectDescription, projectData.repoUrl);
        logSuccess(`Project "${projectData.projectName}" created successfully at ${projectPath}`);
        return projectPath;
    }
    catch (err) {
        logError(`Failed to create project: ${getErrorMessage(err)}`);
        throw err;
    }
    finally {
        // Clean up the environment variable
        delete process.env.TENEX_PROJECT_INIT;
    }
}
async function createProjectDirectory(projectPath, repoUrl) {
    let projectExists = false;
    try {
        await access(projectPath);
        projectExists = true;
        logInfo(`Using existing project directory: ${projectPath}`);
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code !== "ENOENT")
            throw err;
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
        }
        catch (err) {
            let errorMessage = "Unknown error during clone";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            else if (err && typeof err === "object" && "stderr" in err) {
                errorMessage = String(err.stderr);
            }
            logError(`Failed to clone repository: ${errorMessage}`);
            await execAsync(`rm -rf "${projectPath}"`);
            throw err;
        }
    }
    else if (repoUrl && projectExists) {
        logWarning("Repository URL provided but project directory already exists. Skipping clone.");
    }
    else if (!projectExists) {
        logInfo("Initializing empty git repository...");
        await execAsync(`cd "${projectPath}" && git init`);
    }
    else {
        try {
            await execAsync(`cd "${projectPath}" && git status`);
            logInfo("Existing git repository detected");
        }
        catch {
            logInfo("Initializing git repository in existing directory...");
            await execAsync(`cd "${projectPath}" && git init`);
        }
    }
}
async function createTenexDirectory(tenexDir) {
    // Check if .tenex already exists (e.g., from cloned template)
    let tenexExists = false;
    try {
        await access(tenexDir);
        tenexExists = true;
        logInfo(".tenex directory found from template. Updating configuration...");
    }
    catch (err) {
        if (err instanceof Error && "code" in err && err.code !== "ENOENT")
            throw err;
    }
    if (!tenexExists) {
        logInfo("Creating .tenex directory structure...");
        await mkdir(tenexDir, { recursive: true });
    }
}
async function getGitRemoteUrl(projectPath) {
    try {
        const { stdout } = await execAsync(`cd "${projectPath}" && git config --get remote.origin.url`);
        return stdout.trim();
    }
    catch {
        // No remote origin set yet, that's fine
        return null;
    }
}
async function publishAgentProfiles(agentsConfig, projectTitle) {
    for (const [agentKey, agentData] of Object.entries(agentsConfig)) {
        try {
            const nsec = typeof agentData === "string" ? agentData : agentData.nsec;
            await publishAgentProfile(nsec, agentKey, projectTitle, agentKey === "default");
            logSuccess(`✅ Published kind:0 profile for agent '${agentKey}' with avatar`);
        }
        catch (err) {
            logWarning(`Failed to publish kind:0 profile for agent '${agentKey}': ${getErrorMessage(err)}`);
        }
    }
}
async function createInitialProjectFiles(projectPath, projectTitle, projectDescription, repoUrl) {
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
}
//# sourceMappingURL=projects.js.map