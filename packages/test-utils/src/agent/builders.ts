import type { AgentConfig } from "@tenex/types/agents";
import type { ConversationMessage } from "@tenex/types/conversation";

/**
 * Builder for creating test agent configurations
 */
export class AgentBuilder {
    private agent: Partial<AgentConfig>;

    constructor() {
        this.agent = {
            metadata: {},
        };
    }

    withName(name: string): this {
        this.agent.name = name;
        return this;
    }

    withNsec(nsec: string): this {
        this.agent.nsec = nsec;
        return this;
    }

    withRole(role: string): this {
        if (!this.agent.metadata) this.agent.metadata = {};
        this.agent.metadata.role = role;
        return this;
    }

    withInstructions(instructions: string): this {
        if (!this.agent.metadata) this.agent.metadata = {};
        this.agent.metadata.instructions = instructions;
        return this;
    }

    withDescription(description: string): this {
        if (!this.agent.metadata) this.agent.metadata = {};
        this.agent.metadata.description = description;
        return this;
    }

    withVersion(version: string): this {
        if (!this.agent.metadata) this.agent.metadata = {};
        this.agent.metadata.version = version;
        return this;
    }

    build(): AgentConfig {
        if (!this.agent.name) this.agent.name = "test-agent";
        if (!this.agent.nsec) this.agent.nsec = `nsec1test${Math.random().toString(36).slice(2)}`;
        if (!this.agent.npub) this.agent.npub = `npub1test${Math.random().toString(36).slice(2)}`;
        if (!this.agent.pubkey) this.agent.pubkey = `pubkey-${this.agent.name}`;

        return this.agent as AgentConfig;
    }
}

/**
 * Builder for creating conversation messages
 */
export class MessageBuilder {
    private message: Partial<ConversationMessage>;

    constructor() {
        this.message = {
            timestamp: Date.now(),
        };
    }

    withRole(role: "user" | "assistant" | "system"): this {
        this.message.role = role;
        return this;
    }

    withContent(content: string): this {
        this.message.content = content;
        return this;
    }

    withName(name: string): this {
        this.message.name = name;
        return this;
    }

    withToolCalls(
        toolCalls: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
        }>
    ): this {
        this.message.tool_calls = toolCalls;
        return this;
    }

    withTimestamp(timestamp: number): this {
        this.message.timestamp = timestamp;
        return this;
    }

    build(): ConversationMessage {
        if (!this.message.role) this.message.role = "user";
        if (!this.message.content) this.message.content = "Test message";

        return this.message as ConversationMessage;
    }
}

/**
 * Convenience builders
 */
export const agentBuilders = {
    /**
     * Creates a default agent
     */
    defaultAgent: () =>
        new AgentBuilder()
            .withName("default")
            .withRole("General Assistant")
            .withInstructions("You are a helpful assistant"),

    /**
     * Creates a code agent
     */
    codeAgent: () =>
        new AgentBuilder()
            .withName("code")
            .withRole("Software Engineer")
            .withInstructions("You are an expert programmer who writes clean, efficient code"),

    /**
     * Creates a planner agent
     */
    plannerAgent: () =>
        new AgentBuilder()
            .withName("planner")
            .withRole("Project Planner")
            .withInstructions("You excel at breaking down complex projects into manageable tasks"),

    /**
     * Creates a debug agent
     */
    debugAgent: () =>
        new AgentBuilder()
            .withName("debug")
            .withRole("Debugging Specialist")
            .withInstructions("You are an expert at finding and fixing bugs in code"),
};

export const messageBuilders = {
    /**
     * Creates a user message
     */
    userMessage: (content: string) => new MessageBuilder().withRole("user").withContent(content),

    /**
     * Creates an assistant message
     */
    assistantMessage: (content: string, name?: string) => {
        const builder = new MessageBuilder().withRole("assistant").withContent(content);

        if (name) builder.withName(name);
        return builder;
    },

    /**
     * Creates a system message
     */
    systemMessage: (content: string) =>
        new MessageBuilder().withRole("system").withContent(content),
};
