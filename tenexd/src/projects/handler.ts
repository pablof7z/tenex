import { NDKEvent, NDK } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import path from "path";
import { checkProjectExists, extractProjectIdentifierFromTag, initializeProject } from "../../../shared/src/projects.js";
import { logError, logInfo, logSuccess, logWarning } from "../../../shared/src/logger.js";
import { Config } from "../config/config.js";
import { spawn } from "child_process";
import chalk from "chalk";

async function executeTaskCommand(
    config: Config,
    projectPath: string,
    nevent: string
): Promise<void> {
    const command = config.taskCommand;
    
    logInfo(`Executing task command: ${command} ${nevent}`);
    logInfo(`Working directory: ${projectPath}`);
    
    return new Promise((resolve, reject) => {
        const fullCommand = `${command} ${nevent}`;
        
        const child = spawn(fullCommand, [], {
            cwd: projectPath,
            stdio: "inherit",
            shell: true
        });
        
        child.on("error", (error) => {
            logError(`Failed to execute task command: ${error.message}`);
            reject(error);
        });
        
        child.on("exit", (code) => {
            if (code === 0) {
                logSuccess("Task command completed successfully");
                resolve();
            } else {
                logError(`Task command exited with code ${code}`);
                reject(new Error(`Task command exited with code ${code}`));
            }
        });
    });
}

export async function handleTaskEvent(event: NDKEvent, config: Config, ndk: NDK): Promise<void> {
    if (!config.projectsPath) {
        logError("Configuration error: projectsPath is not set");
        throw new Error("Configuration error: projectsPath is required but not set");
    }
    
    const projectTag = event.tagValue("a");
    const taskId = event.tagValue("e");
    
    if (!projectTag) {
        logWarning("Task event missing project 'a' tag");
        return;
    }
    
    if (!taskId) {
        logWarning("Task event missing task 'e' tag");
        return;
    }
    
    try {
        const projectIdentifier = extractProjectIdentifierFromTag(projectTag);
        logInfo(`Processing task ${taskId} for project ${projectIdentifier}`);
        
        // Fetch the actual task event referenced by the "e" tag
        logInfo(`Fetching task event with ID: ${taskId}`);
        const taskEvent = await ndk.fetchEvent(taskId);
        
        if (!taskEvent) {
            logError(`Failed to fetch task event with ID: ${taskId}`);
            return;
        }
        
        logSuccess(`Fetched task event: ${taskEvent.content.substring(0, 50)}...`);
        
        const projectInfo = await checkProjectExists(config.projectsPath, projectIdentifier);
        
        let projectPath: string;
        
        if (projectInfo.exists) {
            logSuccess(`Project ${projectInfo.name} found at ${projectInfo.path}`);
            projectPath = projectInfo.path;
        } else {
            logWarning(`Project ${projectInfo.name} not found locally at ${projectInfo.path}`);
            logInfo("Project needs to be initialized. Need to fetch project event and initialize...");
            
            try {
                const projectNaddr = extractProjectNaddrFromEvent(event);
                if (projectNaddr) {
                    logInfo(`Initializing project using naddr: ${projectNaddr}`);
                    projectPath = await initializeProject({
                        path: config.projectsPath,
                        naddr: projectNaddr
                    });
                    logSuccess(`Project initialized at ${projectPath}`);
                } else {
                    logError("Cannot initialize project: no project naddr found in task event");
                    return;
                }
            } catch (err: any) {
                logError(`Failed to initialize project: ${err.message}`);
                return;
            }
        }
        
        // Generate nevent from the fetched task event (not the 24010 event)
        const nevent = taskEvent.encode();
        
        // Execute the task command with the actual task event's nevent
        try {
            await executeTaskCommand(
                config,
                projectPath,
                nevent
            );
        } catch (err: any) {
            logError(`Failed to execute task: ${err.message}`);
        }
        
    } catch (err: any) {
        logError(`Failed to handle task event: ${err.message}`);
    }
}

function extractProjectNaddrFromEvent(event: NDKEvent): string | null {
    const projectTag = event.tags.find(tag => tag[0] === "project");
    if (projectTag && projectTag[1]) {
        return projectTag[1];
    }
    
    const aTag = event.tagValue("a");
    if (aTag) {
        const parts = aTag.split(":");
        if (parts.length >= 3) {
            const kind = parts[0];
            const pubkey = parts[1];
            const identifier = parts[2];
            
            try {
                return nip19.naddrEncode({
                    kind: parseInt(kind),
                    pubkey: pubkey,
                    identifier: identifier
                });
            } catch (err) {
                logError("Failed to encode naddr from a tag");
                return null;
            }
        }
    }
    
    return null;
}