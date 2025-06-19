import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import NDK from "@nostr-dev-kit/ndk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentResponse, EventContext } from "../../core/types";
import { NostrPublisher } from "../NostrPublisher";

describe("NostrPublisher", () => {
    let publisher: NostrPublisher;
    let ndk: NDK;
    let mockEvent: NDKEvent;
    let agentSigner: NDKPrivateKeySigner;
    let agentPubkey: string;
    let mockProjectEvent: any;

    beforeEach(async () => {
        ndk = new NDK();
        publisher = new NostrPublisher(ndk);

        // Create agent signer
        agentSigner = NDKPrivateKeySigner.generate();
        const agentUser = await agentSigner.user();
        agentPubkey = agentUser.pubkey;

        // Create mock event with reply method
        mockEvent = new NDKEvent(ndk);
        mockEvent.id = "original-event-id";
        mockEvent.pubkey = "user-pubkey";
        mockEvent.content = "User message";

        // Mock the reply method to add p-tags including the agent
        mockEvent.reply = vi.fn().mockImplementation(() => {
            const replyEvent = new NDKEvent(ndk);
            replyEvent.content = "";
            replyEvent.tags = [
                ["e", mockEvent.id!],
                ["p", "user-pubkey"], // Original author
                ["p", agentPubkey], // Agent's own pubkey (should be removed)
                ["p", "other-agent-pubkey"], // Another agent
            ];
            replyEvent.sign = vi.fn().mockResolvedValue(undefined);
            replyEvent.publish = vi.fn().mockResolvedValue(undefined);
            replyEvent.tag = vi.fn(); // Mock the tag method
            return replyEvent;
        });

        // Create mock project event
        mockProjectEvent = new NDKEvent(ndk, {
            kind: 31933,
            tags: [],
            pubkey: "project-pubkey",
        });
    });

    describe("publishResponse", () => {
        it("should remove agent's own p-tag from reply", async () => {
            const response: AgentResponse = {
                content: "Agent response",
            };

            const context: EventContext = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: mockEvent,
                projectEvent: mockProjectEvent,
            };

            const replyEvent = mockEvent.reply();
            const publishSpy = vi.spyOn(replyEvent, "publish");

            // Replace the mock to return our spy
            mockEvent.reply = vi.fn().mockReturnValue(replyEvent);

            await publisher.publishResponse(response, context, agentSigner);

            // Verify the agent's p-tag was removed
            const pTags = replyEvent.tags.filter((tag) => tag[0] === "p");
            expect(pTags).toHaveLength(2); // Should only have user and other agent
            expect(pTags.some((tag) => tag[1] === agentPubkey)).toBe(false);
            expect(pTags.some((tag) => tag[1] === "user-pubkey")).toBe(true);
            expect(pTags.some((tag) => tag[1] === "other-agent-pubkey")).toBe(true);

            // Verify event was published
            expect(publishSpy).toHaveBeenCalled();
        });

        it("should preserve all non-p tags", async () => {
            const response: AgentResponse = {
                content: "Agent response",
                signal: { type: "complete", reason: "Done" },
            };

            const context: EventContext = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: mockEvent,
                projectEvent: mockProjectEvent,
            };

            const replyEvent = mockEvent.reply();
            // Add some other tags
            replyEvent.tags.push(["t", "test"]);
            replyEvent.tags.push(["custom", "value"]);
            replyEvent.tag = vi.fn(); // Mock the tag method

            mockEvent.reply = vi.fn().mockReturnValue(replyEvent);

            await publisher.publishResponse(response, context, agentSigner);

            // Verify non-p tags are preserved
            expect(replyEvent.tags.some((tag) => tag[0] === "e")).toBe(true);
            expect(replyEvent.tags.some((tag) => tag[0] === "t")).toBe(true);
            expect(replyEvent.tags.some((tag) => tag[0] === "custom")).toBe(true);
            expect(replyEvent.tags.some((tag) => tag[0] === "signal")).toBe(true);
        });

        it("should handle case when agent p-tag is not present", async () => {
            const response: AgentResponse = {
                content: "Agent response",
            };

            const context: EventContext = {
                rootEventId: "conv-1",
                projectId: "proj-1",
                originalEvent: mockEvent,
                projectEvent: mockProjectEvent,
            };

            // Create reply without agent's p-tag
            const replyEvent = new NDKEvent(ndk);
            replyEvent.content = "";
            replyEvent.tags = [
                ["e", mockEvent.id!],
                ["p", "user-pubkey"],
                ["p", "other-agent-pubkey"],
            ];
            replyEvent.sign = vi.fn().mockResolvedValue(undefined);
            replyEvent.publish = vi.fn().mockResolvedValue(undefined);
            replyEvent.tag = vi.fn(); // Mock the tag method

            mockEvent.reply = vi.fn().mockReturnValue(replyEvent);

            await publisher.publishResponse(response, context, agentSigner);

            // Verify p-tags remain unchanged
            const pTags = replyEvent.tags.filter((tag) => tag[0] === "p");
            expect(pTags).toHaveLength(2);
        });
    });
});
