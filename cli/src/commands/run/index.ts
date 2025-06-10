import { exec, spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import { logError, logInfo, logSuccess, logWarning } from "../../utils/logger";
import { getNDK } from "../../nostr/ndkClient";
import { NDKEvent, NDKProject } from "@nostr-dev-kit/ndk";
import { nip19 } from "nostr-tools";
import { ClaudeOutputParser } from "../../utils/claudeOutputParser";
import { getAgentSigner } from "../../utils/agentManager";

const execAsync = promisify(exec);

export interface RunOptions {
    nevent1?: string;
    projectPath?: string;
    taskId?: string;
    taskTitle?: string;
    taskDescription?: string;
    context?: string;
    roo?: boolean;
    claude?: boolean;
    goose?: boolean;
    dryRun?: boolean;
}

export async function runTask(nevent1: string, options: any = {}) {
    try {
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

        const ndk = await getNDK();
        logInfo(`Fetching event: ${nevent1}`);
        
        const event = await ndk.fetchEvent(nevent1);
        
        if (!event) {
            logError(`No event found with ID: ${nevent1}`);
            process.exit(1);
        }
        
        if (event.kind !== 1934) {
            logError(`Event is not a task (kind ${event.kind}, expected 1934)`);
            process.exit(1);
        }
        
        const title = event.tags.find(tag => tag[0] === "title")?.[1] || "Untitled Task";
        const content = event.content || "No content";
        
        // Use current working directory as project path
        const projectPath = process.cwd();

        // Route to appropriate backend
        if (options.roo) {
            await runWithRoo({
                projectPath,
                taskId: event.id,
                taskTitle: title,
                taskDescription: content,
                dryRun: false
            });
        } else if (options.claude) {
            await runWithClaude(event, projectPath);
        } else if (options.goose) {
            logWarning("Goose backend is not implemented yet");
            process.exit(1);
        }
        
    } catch (err: any) {
        logError(`Failed to run task: ${err.message}`);
        process.exit(1);
    }
}

export async function runTaskOld(options: RunOptions) {
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
        logError("Old-style Claude invocation not supported. Please use tenex run <nevent> --claude");
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
        
        // Ensure process exits cleanly
        process.exit(0);
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

async function runWithClaude(event: NDKEvent, projectPath: string) {
    const taskId = event.id;
    const title = event.tags.find(tag => tag[0] === "title")?.[1] || "Untitled Task";
    const content = event.content || "No content";
    
    logInfo(`Running task ${taskId} with Claude backend...`);
    
    // Check for existing session
    const sessionId = await getExistingSessionId(projectPath, taskId);
    if (sessionId) {
        logInfo(`Found existing session: ${sessionId}`);
    }
    
    try {
        // Validate project path exists
        await fs.access(projectPath);
        
        // Check if .tenex/claude-mcp.json exists, create if missing
        const mcpConfigPath = path.join(projectPath, ".tenex", "claude-mcp.json");
        try {
            await fs.access(mcpConfigPath);
            logInfo("Found existing claude-mcp.json configuration");
        } catch {
            logInfo("Creating claude-mcp.json configuration...");
            await createClaudeMcpConfig(projectPath);
        }
        
        // Prepare the task data to send via stdin
        const taskData = `Task ID: ${taskId}

${title}

${content}

---
IMPORTANT: You are using the TENEX MCP server. When calling the mcp__tenex-mcp__publish_task_status_update tool, you MUST provide "claude-code" as the agent_name parameter. This is your agent identity for this project.`;
        
        // Build the claude command
        const claudeCommand = "claude";
        const claudeArgs = [
            "-p",
            "--output-format", "stream-json",
            "--verbose",
            "--dangerously-skip-permissions",
            "--mcp-config", mcpConfigPath
        ];
        
        // Add resume flag if we have an existing session
        if (sessionId) {
            claudeArgs.push("-r", sessionId);
        }
        
        logInfo("Executing Claude with task data...");
        logInfo(`Command: ${claudeCommand} ${claudeArgs.join(" ")}`);
        
        // Create output parser
        const parser = new ClaudeOutputParser();
        let newSessionId: string | null = null;
        
        parser.on("sessionInit", async ({ sessionId: sid }) => {
            if (sid && !sessionId) {
                // Save new session ID
                newSessionId = sid;
                await saveSessionId(projectPath, taskId, sid);
            }
        });
        
        // Spawn the claude process
        const claudeProcess = spawn(claudeCommand, claudeArgs, {
            cwd: projectPath,
            stdio: ["pipe", "pipe", "pipe"]
        });
        
        // Send task data via stdin if not resuming
        if (!sessionId) {
            claudeProcess.stdin.write(taskData);
            claudeProcess.stdin.end();
        }
        
        // Handle stdout with parser
        claudeProcess.stdout.on("data", (data) => {
            parser.parse(data.toString());
        });
        
        // Handle stderr
        claudeProcess.stderr.on("data", (data) => {
            process.stderr.write(data);
        });
        
        // Handle process exit
        claudeProcess.on("close", (code) => {
            parser.flush();
            if (code === 0) {
                logSuccess("Task completed successfully");
            } else {
                logError(`Claude process exited with code ${code}`);
            }
            process.exit(code || 0);
        });
        
        claudeProcess.on("error", (err) => {
            logError(`Failed to execute Claude: ${err.message}`);
            process.exit(1);
        });
        
    } catch (err: any) {
        logError(`Failed to run task with Claude: ${err.message}`);
        process.exit(1);
    }
}

async function createClaudeMcpConfig(projectPath: string) {
    const tenexDir = path.join(projectPath, ".tenex");
    const mcpConfigPath = path.join(tenexDir, "claude-mcp.json");
    
    try {
        // Get or create claude-code agent
        const { agent } = await getAgentSigner(projectPath, "claude-code");
        
        // Create claude-mcp.json
        // The MCP server binary should be at /Users/pablofernandez/test123/TENEX-pfkmc9/mcp/tenex-mcp
        const mcpServerPath = "/Users/pablofernandez/test123/TENEX-pfkmc9/mcp/tenex-mcp";
        const agentsPath = path.join(tenexDir, "agents.json");
        
        const mcpConfig = {
            mcpServers: {
                tenex: {
                    command: mcpServerPath,
                    args: [
                        "--config-file",
                        agentsPath
                    ]
                }
            }
        };
        
        await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
        logSuccess(`Created ${mcpConfigPath}`);
        
    } catch (err: any) {
        logError(`Failed to create claude-mcp.json: ${err.message}`);
        throw err;
    }
}

async function getExistingSessionId(projectPath: string, taskId: string): Promise<string | null> {
    const sessionsPath = path.join(projectPath, ".tenex", "sessions", "claude-code.json");
    
    try {
        const content = await fs.readFile(sessionsPath, 'utf-8');
        const sessions = JSON.parse(content);
        return sessions[taskId] || null;
    } catch {
        return null;
    }
}

async function saveSessionId(projectPath: string, taskId: string, sessionId: string): Promise<void> {
    const sessionsDir = path.join(projectPath, ".tenex", "sessions");
    const sessionsPath = path.join(sessionsDir, "claude-code.json");
    
    try {
        // Ensure sessions directory exists
        await fs.mkdir(sessionsDir, { recursive: true });
        
        // Load existing sessions or create new object
        let sessions: Record<string, string> = {};
        try {
            const content = await fs.readFile(sessionsPath, 'utf-8');
            sessions = JSON.parse(content);
        } catch {
            // File doesn't exist, start with empty object
        }
        
        // Save the session ID
        sessions[taskId] = sessionId;
        await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2));
        
        logInfo(`Saved session ID for task ${taskId}`);
    } catch (err: any) {
        logWarning(`Failed to save session ID: ${err.message}`);
    }
}