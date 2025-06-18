import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentConfig, ConversationStore, LLMProvider, NostrPublisher } from "../../core/types";
import { Agent } from "../Agent";

describe("Agent Self-Reply Guard", () => {
    let agent: Agent;
    let mockStore: ConversationStore;
    let mockPublisher: NostrPublisher;
    let mockLLM: LLMProvider;
    let ndk: NDK;
    let agentConfig: AgentConfig;
    let agentSigner: NDKPrivateKeySigner;
    let agentPubkey: string;

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

        mockLLM = {
            complete: vi.fn().mockResolvedValue({
                content: "Mock response",
                model: "mock-model",
            }),
        };

        ndk = new NDK();

        // Create agent with known keys
        agentSigner = NDKPrivateKeySigner.generate();
        const agentUser = await agentSigner.user();
        agentPubkey = agentUser.pubkey;

        agentConfig = {
            name: "test-agent",
            role: "Test Agent",
            instructions: "Test instructions",
            nsec: agentSigner.privateKey!,
        };

        agent = new Agent(agentConfig, mockLLM, mockStore, mockPublisher, ndk);
        await agent.initialize();

        // Set agent as active speaker
        agent.setActiveSpeaker(true);
    });

    describe("handleEvent", () => {
        it("should not respond to its own events", async () => {
            // Create event from the agent itself
            const ownEvent = new NDKEvent();
            ownEvent.pubkey = agentPubkey;
            ownEvent.content = "Agent's own message";
            ownEvent.id = "own-event-id";

            const context = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: ownEvent,
            };

            await agent.handleEvent(ownEvent, context);

            // Should not publish any response
            expect(mockPublisher.publishResponse).not.toHaveBeenCalled();
            expect(mockLLM.complete).not.toHaveBeenCalled();
        });

        it("should respond to events from other users", async () => {
            // Create event from another user
            const userEvent = new NDKEvent();
            userEvent.pubkey = "different-user-pubkey";
            userEvent.content = "User message";
            userEvent.id = "user-event-id";

            // Mock reply method
            userEvent.reply = vi.fn().mockImplementation(() => {
                const replyEvent = new NDKEvent(ndk);
                replyEvent.tags = [];
                replyEvent.sign = vi.fn();
                replyEvent.publish = vi.fn();
                return replyEvent;
            });

            const context = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await agent.handleEvent(userEvent, context);

            // Should publish response
            expect(mockPublisher.publishResponse).toHaveBeenCalled();
            expect(mockLLM.complete).toHaveBeenCalled();
        });

        it("should respond to events from other agents", async () => {
            // Create event from another agent
            const otherAgentEvent = new NDKEvent();
            otherAgentEvent.pubkey = "other-agent-pubkey";
            otherAgentEvent.content = "Other agent message";
            otherAgentEvent.id = "other-agent-event-id";

            // Mock reply method
            otherAgentEvent.reply = vi.fn().mockImplementation(() => {
                const replyEvent = new NDKEvent(ndk);
                replyEvent.tags = [];
                replyEvent.sign = vi.fn();
                replyEvent.publish = vi.fn();
                return replyEvent;
            });

            const context = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: otherAgentEvent,
            };

            await agent.handleEvent(otherAgentEvent, context);

            // Should publish response
            expect(mockPublisher.publishResponse).toHaveBeenCalled();
            expect(mockLLM.complete).toHaveBeenCalled();
        });

        it("should not respond when not active speaker", async () => {
            // Set agent as inactive
            agent.setActiveSpeaker(false);

            const userEvent = new NDKEvent();
            userEvent.pubkey = "user-pubkey";
            userEvent.content = "User message";
            userEvent.id = "user-event-id";

            const context = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: userEvent,
            };

            await agent.handleEvent(userEvent, context);

            // Should not publish response
            expect(mockPublisher.publishResponse).not.toHaveBeenCalled();
            expect(mockLLM.complete).not.toHaveBeenCalled();
        });
    });
});
