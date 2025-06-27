import type { SDKMessage, SDKAssistantMessage } from "@anthropic-ai/claude-code";
import type { TextBlock, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages/messages";
import type { NostrEvent } from "@/types/nostr";

interface TodoItem {
    content: string;
    status: string;
    priority: string;
    id: string;
}

type ContentBlock = TextBlock | ToolUseBlock;

type FormattedToolUse = { 
    name: string; 
    todos?: string[]; 
    input?: unknown;
};

/**
 * Translates Claude SDK messages to Nostr event format
 * Single Responsibility: Message format translation
 */
export class ClaudeToNostrTranslator {
    translateMessage(message: SDKMessage): NostrEvent | null {
        switch (message.type) {
            case 'assistant':
                return this.translateAssistantMessage(message);
            case 'system':
                return this.translateSystemMessage(message);
            case 'result':
                return this.translateResultMessage(message);
            default:
                return null;
        }
    }

    private translateAssistantMessage(message: SDKAssistantMessage): NostrEvent {
        const textContent = this.extractTextContent(message);
        const toolUses = this.extractToolUses(message);

        return {
            kind: 1,
            content: textContent,
            tags: [
                ["llm", JSON.stringify({
                    model: "claude",
                    role: "assistant",
                    tools: toolUses,
                })],
            ],
        };
    }

    private translateSystemMessage(message: SDKMessage): NostrEvent {
        if (message.type !== 'system') return null;
        
        return {
            kind: 1,
            content: `Session started: ${message.session_id}`,
            tags: [
                ["llm", JSON.stringify({
                    model: message.model,
                    sessionId: message.session_id,
                    tools: message.tools,
                })],
            ],
        };
    }

    private translateResultMessage(message: SDKMessage): NostrEvent | null {
        if (message.type !== 'result') return null;

        const metadata: any = {
            subtype: message.subtype,
            duration_ms: message.duration_ms,
        };

        if ('total_cost_usd' in message) {
            metadata.cost = message.total_cost_usd;
            metadata.usage = message.usage;
        }

        return {
            kind: 1,
            content: `Execution ${message.subtype}`,
            tags: [
                ["llm", JSON.stringify(metadata)],
            ],
        };
    }

    private extractTextContent(message: SDKAssistantMessage): string {
        if (!message.message?.content) return '';
        
        return message.message.content
            .filter((c): c is TextBlock => c.type === 'text')
            .map(c => c.text)
            .join('');
    }

    private extractToolUses(message: SDKAssistantMessage): FormattedToolUse[] {
        if (!message.message?.content) return [];
        
        return message.message.content
            .filter((c): c is ToolUseBlock => c.type === 'tool_use')
            .map((tool): FormattedToolUse => {
                // Special handling for TodoWrite
                if (tool.name === 'TodoWrite' && tool.input && typeof tool.input === 'object' && 'todos' in tool.input) {
                    return {
                        name: tool.name,
                        todos: this.formatTodos((tool.input as { todos: TodoItem[] }).todos),
                    };
                }
                return {
                    name: tool.name,
                    input: tool.input,
                };
            });
    }

    private formatTodos(todos: TodoItem[]): string[] {
        return todos.map(todo => 
            `${this.getStatusEmoji(todo.status)} ${todo.content}`
        );
    }

    private getStatusEmoji(status: string): string {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '🔄';
            default: return '📝';
        }
    }
}