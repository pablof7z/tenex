import { AgentRegistry } from "@/agents/AgentRegistry";
import { getProjectContext } from "@/services";
import { ensureProjectInitialized } from "@/utils/projectInitialization";
import { type Phase, ALL_PHASES } from "@/conversations/phases";
import { formatError } from "@/utils/errors";
import { logError, logInfo } from "@/utils/logger";
import { buildSystemPrompt } from "@/prompts/utils/systemPromptBuilder";
import { mcpService } from "@/services/mcp/MCPService";
import type { Tool } from "@/tools/types";
import chalk from "chalk";

// Format markdown
function formatMarkdown(text: string): string {
    return text
        .replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) =>
            chalk.bold.blue(`${hashes} ${content}`)
        )
        .replace(/\*\*([^*]+)\*\*/g, chalk.bold("$1"))
        .replace(/\*([^*]+)\*/g, chalk.italic("$1"))
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            return `${chalk.gray(`\`\`\`${lang || ""}`)}\n${chalk.green(code)}${chalk.gray("```")}`;
        })
        .replace(/`([^`]+)`/g, chalk.yellow("`$1`"))
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, chalk.cyan("[$1]") + chalk.gray("($2)"))
        .replace(
            /^(\s*)([-*+])\s+(.+)$/gm,
            (_, spaces, bullet, content) => `${spaces}${chalk.yellow(bullet)} ${content}`
        )
        .replace(
            /^(\s*)(\d+\.)\s+(.+)$/gm,
            (_, spaces, num, content) => `${spaces}${chalk.yellow(num)} ${content}`
        );
}

// Format JSON
function colorizeJSON(json: string): string {
    return json
        .replace(/"([^"]+)":/g, chalk.cyan('"$1":'))
        .replace(/: "([^"]+)"/g, `: ${chalk.green('"$1"')}`)
        .replace(/: (\d+)/g, `: ${chalk.yellow("$1")}`)
        .replace(/: (true|false)/g, `: ${chalk.magenta("$1")}`)
        .replace(/: null/g, `: ${chalk.gray("null")}`);
}

// Format content with enhancements
function formatContentWithEnhancements(content: string, isSystemPrompt = false): string {
    let formattedContent = content.replace(/\\n/g, "\n");

    if (isSystemPrompt) {
        formattedContent = formatMarkdown(formattedContent);
    }

    // Handle <tool_use> blocks
    formattedContent = formattedContent.replace(
        /<tool_use>([\s\S]*?)<\/tool_use>/g,
        (_match, jsonContent) => {
            try {
                const parsed = JSON.parse(jsonContent.trim());
                const formatted = JSON.stringify(parsed, null, 2);
                return (
                    chalk.gray("<tool_use>\n") +
                    colorizeJSON(formatted) +
                    chalk.gray("\n</tool_use>")
                );
            } catch {
                return chalk.gray("<tool_use>") + jsonContent + chalk.gray("</tool_use>");
            }
        }
    );

    return formattedContent;
}

interface DebugSystemPromptOptions {
    agent: string;
    phase: string;
}

export async function runDebugSystemPrompt(options: DebugSystemPromptOptions) {
    try {
        const projectPath = process.cwd();

        logInfo(`🔍 Debug: Loading system prompt for agent '${options.agent}'`);

        // Initialize project context if needed
        await ensureProjectInitialized(projectPath);

        // Load agent from registry
        const agentRegistry = new AgentRegistry(projectPath);
        await agentRegistry.loadFromProject();
        const agent = agentRegistry.getAgent(options.agent);

        console.log(chalk.cyan("\n=== Agent Information ==="));
        if (agent) {
            console.log(chalk.white("Name:"), agent.name);
            console.log(chalk.white("Role:"), agent.role);
            console.log(chalk.white("Phase:"), options.phase);
            if (agent.tools && agent.tools.length > 0) {
                console.log(chalk.white("Tools:"), agent.tools.join(", "));
            }
        } else {
            console.log(chalk.yellow(`Note: Agent '${options.agent}' not found in registry`));
        }

        console.log(chalk.cyan("\n=== System Prompt ==="));

        if (agent) {
            const projectCtx = getProjectContext();
            const project = projectCtx.project;
            const titleTag = project.tags.find((tag) => tag[0] === "title");
            const repoTag = project.tags.find((tag) => tag[0] === "repo");

            // Get all available agents for handoffs
            const availableAgents = Array.from(projectCtx.agents.values());

            // Validate phase
            const phase = (
                ALL_PHASES.includes(options.phase as Phase) ? options.phase : "chat"
            ) as Phase;

            // Initialize MCP service to get tools
            let mcpTools: Tool[] = [];
            try {
                await mcpService.initialize(projectPath);
                mcpTools = await mcpService.getAvailableTools();
                logInfo(`Loaded ${mcpTools.length} MCP tools`);
            } catch (error) {
                logError(`Failed to initialize MCP service: ${error}`);
                // Continue without MCP tools - don't fail the whole debug command
            }

            // Build system prompt using the shared function - exactly as production does
            const systemPrompt = buildSystemPrompt({
                agent,
                phase,
                projectTitle: titleTag?.[1] || "Untitled Project",
                projectRepository: repoTag?.[1],
                availableAgents,
                conversation: undefined, // No conversation in debug mode
                agentLessons: projectCtx.agentLessons,
                mcpTools,
                claudeCodeReport: undefined, // No Claude Code report in debug mode
            });

            // Format and display the system prompt with enhancements
            const formattedPrompt = formatContentWithEnhancements(systemPrompt, true);
            console.log(formattedPrompt);
        } else {
            console.log(chalk.yellow(`Agent '${options.agent}' not found in registry`));
        }

        console.log(chalk.cyan("===================\n"));

        logInfo("System prompt displayed successfully");
    } catch (err) {
        const errorMessage = formatError(err);
        logError(`Failed to generate system prompt: ${errorMessage}`);
        process.exit(1);
    }
}
