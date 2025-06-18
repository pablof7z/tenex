import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getNDK } from "@/nostr/ndkClient";
import { NDKEvent, type NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { EVENT_KINDS, logError, logInfo, logWarning } from "@tenex/shared";
import type { AgentDefinition, AgentsJson } from "@tenex/types/agents";
import { getErrorMessage } from "@tenex/types/utils";

/**
 * Convert agent name to kebab-case for use as key in agents.json
 * Examples: "Christ" -> "christ", "Hello World" -> "hello-world"
 */
export function toKebabCase(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Read agents.json file from a project
 */
export async function readAgentsJson(projectPath: string): Promise<AgentsJson> {
    const agentsPath = path.join(projectPath, ".tenex", "agents.json");
    try {
        const content = await readFile(agentsPath, "utf-8");
        return JSON.parse(content) as AgentsJson;
    } catch (error: unknown) {
        logError(`Failed to read agents.json: ${getErrorMessage(error)}`);
        throw error;
    }
}

/**
 * Publish typing indicator event - direct NDK usage
 */
export async function publishTypingIndicator(
    originalEvent: NDKEvent,
    name: string,
    signer: NDKPrivateKeySigner,
    isTyping: boolean,
    projectEvent: NDKEvent,
    message?: string,
    systemPrompt?: string,
    userPrompt?: string
): Promise<void> {
    try {
        const ndk = await getNDK();
        const event = new NDKEvent(ndk);
        event.kind = isTyping ? EVENT_KINDS.TYPING_INDICATOR : EVENT_KINDS.TYPING_INDICATOR_STOP;
        event.content = message || (isTyping ? `${name} is typing...` : "");

        event.tag(originalEvent);
        event.tag(projectEvent);

        if (isTyping && systemPrompt) {
            event.tags.push(["system-prompt", systemPrompt]);
        }
        if (isTyping && userPrompt) {
            event.tags.push(["prompt", userPrompt]);
        }

        await event.sign(signer);
        await event.publish();
    } catch (error) {
        logWarning(`Failed to publish typing indicator: ${getErrorMessage(error)}`);
    }
}

/**
 * Publish response event - direct NDK usage
 * Works with the new agent system's response format
 */
export async function publishResponse(
    originalEvent: NDKEvent,
    response: { content: string; signal?: { type: string; reason?: string } },
    signer: NDKPrivateKeySigner,
    projectEvent: NDKEvent,
    metadata?: {
        model?: string;
        provider?: string;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
            cache_read_input_tokens?: number;
            cost?: number;
        };
        temperature?: number;
        maxTokens?: number;
        toolCalls?: number;
        systemPrompt?: string;
        userPrompt?: string;
    }
): Promise<void> {
    try {
        const _ndk = await getNDK();
        const responseEvent = originalEvent.reply();

        responseEvent.content = response.content;

        // Remove duplicate p-tags
        responseEvent.tags = responseEvent.tags.filter((tag) => tag[0] !== "p");
        responseEvent.tag(projectEvent);

        // Add metadata if provided
        if (metadata) {
            addLLMMetadata(responseEvent, metadata);

            if (metadata.systemPrompt) {
                responseEvent.tags.push(["system-prompt", metadata.systemPrompt]);
            }
            if (metadata.userPrompt) {
                responseEvent.tags.push(["prompt", metadata.userPrompt]);
            }
        }

        // Add signal if present
        if (response.signal) {
            responseEvent.tags.push(["signal", response.signal.type]);
            if (response.signal.reason) {
                responseEvent.tags.push(["signal-reason", response.signal.reason]);
            }
        }

        await responseEvent.sign(signer);
        await responseEvent.publish();
    } catch (error) {
        logError(`Failed to publish response: ${getErrorMessage(error)}`);
    }
}

/**
 * Add LLM metadata tags to an event
 */
function addLLMMetadata(
    event: NDKEvent,
    metadata: {
        model?: string;
        provider?: string;
        usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
            cache_read_input_tokens?: number;
            cost?: number;
        };
        temperature?: number;
        maxTokens?: number;
        toolCalls?: number;
    }
): void {
    if (metadata.model) {
        event.tags.push(["llm-model", metadata.model]);
    }
    if (metadata.provider) {
        event.tags.push(["llm-provider", metadata.provider]);
    }

    const usage = metadata.usage;
    if (usage) {
        if (usage.prompt_tokens) {
            event.tags.push(["llm-input-tokens", String(usage.prompt_tokens)]);
        }
        if (usage.completion_tokens) {
            event.tags.push(["llm-output-tokens", String(usage.completion_tokens)]);
        }
        if (usage.total_tokens) {
            event.tags.push(["llm-total-tokens", String(usage.total_tokens)]);
        }
        if (usage.cache_read_input_tokens) {
            event.tags.push(["llm-cache-read-tokens", String(usage.cache_read_input_tokens)]);
        }
        if (usage.cost) {
            event.tags.push(["llm-cost", String(usage.cost)]);
        }
    }

    if (metadata.temperature !== undefined) {
        event.tags.push(["llm-temperature", String(metadata.temperature)]);
    }
    if (metadata.maxTokens !== undefined) {
        event.tags.push(["llm-max-tokens", String(metadata.maxTokens)]);
    }
    if (metadata.toolCalls !== undefined) {
        event.tags.push(["llm-tool-calls", String(metadata.toolCalls)]);
    }
}
