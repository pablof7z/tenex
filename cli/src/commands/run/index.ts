import { exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { logError, logInfo, logSuccess, logWarning } from "../../utils/logger";

const execAsync = promisify(exec);

export interface RunOptions {
    projectPath: string;
    taskId: string;
    taskTitle?: string;
    taskDescription?: string;
    context?: string;
    roo?: boolean;
    claude?: boolean;
    goose?: boolean;
    dryRun?: boolean;
}

export async function runTask(options: RunOptions) {
    // Validate backend selection
    const selectedBackends = [options.roo, options.claude, options.goose].filter(Boolean);
    
    if (selectedBackends.length === 0) {
        logError("Please specify a backend: --roo, --claude, or --goose");
        process.exit(1);
    }
    
    if (selectedBackends.length > 1) {
        logError("Please specify only one backend");
        process.exit(1);
    }
    
    // Route to appropriate backend
    if (options.roo) {
        await runWithRoo(options);
    } else if (options.claude) {
        logWarning("Claude backend is not implemented yet");
        process.exit(1);
    } else if (options.goose) {
        logWarning("Goose backend is not implemented yet");
        process.exit(1);
    }
}

async function runWithRoo(options: RunOptions) {
    const { projectPath, taskId, taskTitle, taskDescription, context, dryRun } = options;
    
    // Generate the task content
    const taskContent = generateTaskMarkdown(taskId, taskTitle, taskDescription, context);
    
    if (dryRun) {
        logInfo("=== DRY RUN MODE ===");
        logInfo(`Backend: Roo (VS Code integration)`);
        logInfo(`Project Path: ${projectPath}`);
        logInfo(`Task ID: ${taskId}`);
        logInfo("\n=== PROMPT CONTENT ===");
        console.log(taskContent);
        logInfo("\n=== END PROMPT ===");
        logInfo("\nThis prompt would be saved to .tenex-trigger in the project directory.");
        return;
    }
    
    logInfo(`Running task ${taskId} with Roo backend...`);
    
    try {
        // Validate project path exists
        await fs.access(projectPath);
        
        // Create temp directory structure
        const tempDir = path.join(projectPath, "temp", "tasks");
        await fs.mkdir(tempDir, { recursive: true });
        
        // Create task markdown file
        const taskFile = path.join(tempDir, `${taskId}.md`);
        await fs.writeFile(taskFile, taskContent);
        
        logSuccess(`Created task file: ${taskFile}`);
        
        // Open VS Code and trigger roo-executor
        await openEditorAndTrigger(projectPath, taskId);
        
        logSuccess("Task triggered successfully in VS Code");
    } catch (err: any) {
        logError(`Failed to run task: ${err.message}`);
        process.exit(1);
    }
}

function generateTaskMarkdown(taskId: string, title?: string, description?: string, context?: string): string {
    const lines = [`# Task ID: ${taskId}`];
    
    if (title) {
        lines.push(`## ${title}`);
    }
    
    if (description) {
        lines.push("", "### Task Description", "", description);
    }
    
    if (context) {
        lines.push("", "### Additional Context", "", context);
    }
    
    lines.push("", "---", "", `Generated at: ${new Date().toISOString()}`);
    
    return lines.join("\n");
}

async function openEditorAndTrigger(projectPath: string, taskId: string) {
    try {
        // Open VS Code with the project
        logInfo("Opening VS Code...");
        await execAsync(`code "${projectPath}"`);
        
        // Wait for VS Code to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Move task file to trigger location
        const taskFile = path.join(projectPath, "temp", "tasks", `${taskId}.md`);
        const triggerFile = path.join(projectPath, ".tenex-trigger");
        
        logInfo("Triggering roo-executor...");
        await execAsync(`mv "${taskFile}" "${triggerFile}"`);
        
    } catch (err: any) {
        throw new Error(`Failed to open editor: ${err.message}`);
    }
}