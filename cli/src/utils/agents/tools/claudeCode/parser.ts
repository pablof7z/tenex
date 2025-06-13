import chalk from "chalk";
import type { ToolContext } from "../types";
import type { ClaudeCodeMessage } from "./types";

export class ClaudeCodeOutputParser {
	private buffer = "";
	private messageCount = 0;
	private totalCost = 0;
	private startTime = Date.now();
	private toolContext?: ToolContext;

	constructor(toolContext?: ToolContext) {
		this.toolContext = toolContext;
	}

	parseLines(data: string): ClaudeCodeMessage[] {
		const lines = (this.buffer + data).split("\n");
		const messages: ClaudeCodeMessage[] = [];

		// Keep the last incomplete line in the buffer
		this.buffer = lines.pop() || "";

		for (const line of lines) {
			if (line.trim()) {
				try {
					const message = JSON.parse(line) as ClaudeCodeMessage;
					messages.push(message);
					// Process message asynchronously without blocking
					this.processMessage(message).catch((error) => {
						console.error("Error processing message:", error);
					});
				} catch (error) {
					console.error("Failed to parse JSON line:", line);
				}
			}
		}

		return messages;
	}

	private async processMessage(message: ClaudeCodeMessage) {
		switch (message.type) {
			case "system":
				// Handle system messages silently
				break;
			case "assistant":
				await this.handleAssistantMessage(message);
				break;
			case "user":
				// Skip user messages - they're just echoes of the prompt
				break;
			case "tool_use":
				await this.handleToolUse(message);
				break;
			case "result":
				this.handleResult(message);
				break;
			default:
				console.log(chalk.gray(`[Unknown message type: ${message.type}]`));
		}
	}

	private async handleAssistantMessage(message: ClaudeCodeMessage) {
		if (message.message?.content) {
			for (const content of message.message.content) {
				if (content.type === "text" && content.text) {
					this.messageCount++;
					const formattedText = this.formatText(content.text);
					console.log(chalk.cyan("\n🤖 Claude:"), formattedText);

					// Send typing indicator with Claude Code's actual output
					if (this.toolContext?.updateTypingIndicator) {
						// Extract the first meaningful line or summary
						const lines = content.text
							.trim()
							.split("\n")
							.filter((line) => line.trim());
						const summary = lines[0] || "Claude Code is processing...";
						await this.toolContext.updateTypingIndicator(
							`[Claude Code] ${summary.slice(0, 200)}`,
						);
					}
				}
			}

			// Show token usage if available
			if (message.message.usage) {
				const usage = message.message.usage;
				const tokens = [
					`Input: ${usage.input_tokens}`,
					usage.cache_read_input_tokens
						? `Cached: ${usage.cache_read_input_tokens}`
						: null,
					`Output: ${usage.output_tokens}`,
				]
					.filter(Boolean)
					.join(", ");

				console.log(chalk.gray(`   [Tokens: ${tokens}]`));
			}
		}
	}

	private async handleToolUse(message: ClaudeCodeMessage) {
		console.log(chalk.yellow("\n🔧 Tool Use Detected"));

		// Send typing indicator for tool use
		if (this.toolContext?.updateTypingIndicator && message.tool_use) {
			const toolName = message.tool_use.name || "tool";
			await this.toolContext.updateTypingIndicator(
				`[Claude Code] Using ${toolName}...`,
			);
		}
	}

	private handleResult(message: ClaudeCodeMessage) {
		const duration = Date.now() - this.startTime;
		const seconds = (duration / 1000).toFixed(1);

		console.log(chalk.green("\n\n✅ Task Complete"));

		if (message.result) {
			console.log(chalk.white("\nSummary:"), this.formatText(message.result));
		}

		// Show statistics
		const stats = [];
		stats.push(`Duration: ${seconds}s`);

		if (message.num_turns) {
			stats.push(`Turns: ${message.num_turns}`);
		}

		if (message.cost_usd || message.total_cost) {
			const cost = message.cost_usd || message.total_cost || 0;
			stats.push(`Cost: $${cost.toFixed(4)}`);
			this.totalCost += cost;
		}

		if (message.usage) {
			const usage = message.usage;
			const totalTokens =
				(usage.input_tokens || 0) +
				(usage.cache_creation_input_tokens || 0) +
				(usage.cache_read_input_tokens || 0) +
				(usage.output_tokens || 0);
			stats.push(`Total Tokens: ${totalTokens.toLocaleString()}`);
		}

		console.log(chalk.gray(`\n[${stats.join(" | ")}]`));

		if (message.is_error) {
			console.log(chalk.red("\n❌ Error occurred during execution"));
		}
	}

	private formatText(text: string): string {
		// Trim excessive whitespace but preserve intentional formatting
		const lines = text.split("\n");
		const trimmedLines = lines.map((line) => line.trimEnd());
		const formatted = trimmedLines.join("\n").trim();

		// Add some basic formatting for common patterns
		return formatted
			.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
				return (
					chalk.gray(`\`\`\`${lang || ""}\n`) +
					chalk.white(code) +
					chalk.gray("```")
				);
			})
			.replace(/`([^`]+)`/g, (match, code) => chalk.green(`\`${code}\``))
			.replace(/\*\*([^*]+)\*\*/g, (match, text) => chalk.bold(text));
	}

	getTotalCost(): number {
		return this.totalCost;
	}

	getMessageCount(): number {
		return this.messageCount;
	}
}
