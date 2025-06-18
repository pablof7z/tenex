import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentConfig, ConversationStore, LLMProvider, NostrPublisher } from "../../core/types";
import { Agent } from "../Agent";
import type { ToolRegistry } from "@/utils/agents/tools/ToolRegistry";

describe("Agent Tool Execution", () => {
    let agent: Agent;
    let mockStore: ConversationStore;
    let mockPublisher: NostrPublisher;
    let mockLLM: LLMProvider;
    let mockToolRegistry: ToolRegistry;
    let ndk: NDK;
    let agentConfig: AgentConfig;

    beforeEach(async () => {
        // Setup mocks
        mockStore = {
            getMessages: vi.fn().mockResolvedValue([]),
            appendMessage: vi.fn(),
            getTeam: vi.fn(),
            saveTeam: vi.fn(),
        };

        mockPublisher = {
            publishResponse: vi.fn(),
            publishTypingIndicator: vi.fn(),
        };

        mockToolRegistry = {
            generateSystemPrompt: vi.fn().mockReturnValue("Tool instructions..."),
            getAllTools: vi.fn().mockReturnValue([]),
            getTool: vi.fn(),
            register: vi.fn(),
            unregister: vi.fn(),
            toAnthropicFormat: vi.fn().mockReturnValue([]),
            toOpenAIFormat: vi.fn().mockReturnValue([]),
        };

        ndk = new NDK();

        // Create agent with known keys
        const agentSigner = NDKPrivateKeySigner.generate();

        agentConfig = {
            name: "test-agent",
            role: "Test Agent",
            instructions: "Test instructions",
            nsec: agentSigner.privateKey!,
        };

        // Mock LLM that returns a response with tool calls
        mockLLM = {
            complete: vi.fn(),
        };

        agent = new Agent(agentConfig, mockLLM, mockStore, mockPublisher, ndk, mockToolRegistry);
        await agent.initialize();

        // Set agent as active speaker
        agent.setActiveSpeaker(true);
    });

    describe("handleEvent with tools", () => {
        it("should execute tools when response contains tool calls", async () => {
            // Mock LLM to return response with tool calls
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: 'I\'ll help you with that. <tool_use>{"tool": "test_tool", "arguments": {"arg1": "value1"}}</tool_use>',
                model: "test-model",
                toolCalls: [{ id: "test1", name: "test_tool", arguments: { arg1: "value1" } }],
            });

            // Create event from another user
            const userEvent = new NDKEvent();
            userEvent.pubkey = "different-user-pubkey";
            userEvent.content = "Please use the test tool";
            userEvent.id = "user-event-id";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await agent.handleEvent(userEvent, context);

            // Should publish initial response without tool calls
            expect(mockPublisher.publishResponse).toHaveBeenCalledTimes(2);
            
            // First call should have cleaned content (no tool_use blocks)
            const firstCall = (mockPublisher.publishResponse as any).mock.calls[0];
            expect(firstCall[0].content).toBe("I'll help you with that.");
            
            // Second call should have tool results
            const secondCall = (mockPublisher.publishResponse as any).mock.calls[1];
            expect(secondCall[0].content).toContain("Here are the results:");
            expect(secondCall[0].metadata?.isToolResult).toBe(true);
        });

        it("should handle responses without tool calls normally", async () => {
            // Mock LLM to return response without tool calls
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: "This is a regular response without tools.",
                model: "test-model",
                // No toolCalls property
            });

            // Create event from another user
            const userEvent = new NDKEvent();
            userEvent.pubkey = "different-user-pubkey";
            userEvent.content = "Just chat normally";
            userEvent.id = "user-event-id";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await agent.handleEvent(userEvent, context);

            // Should publish only once for regular response
            expect(mockPublisher.publishResponse).toHaveBeenCalledTimes(1);
            const call = (mockPublisher.publishResponse as any).mock.calls[0];
            expect(call[0].content).toBe("This is a regular response without tools.");
            expect(call[0].metadata?.isToolResult).toBeUndefined();
        });

        it("should preserve tool-related properties through generateResponse", async () => {
            // Mock LLM to return response with tool calls
            mockLLM.complete = vi.fn().mockResolvedValue({
                content: 'Testing tool preservation <tool_use>{"tool": "test", "arguments": {}}</tool_use>',
                model: "test-model",
                toolCalls: [{ id: "test1", name: "test", arguments: {} }],
                hasNativeToolCalls: true,
            });

            // Create event
            const userEvent = new NDKEvent();
            userEvent.pubkey = "user-pubkey";
            userEvent.content = "Test message";
            userEvent.id = "test-id";

            const context = {
                conversationId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            const response = await agent.generateResponse(userEvent, context);

            // Check that tool-related properties are preserved
            expect(response.toolCalls).toBeDefined();
            expect(response.toolCalls).toHaveLength(1);
            expect(response.hasNativeToolCalls).toBe(true);
        });
    });
});