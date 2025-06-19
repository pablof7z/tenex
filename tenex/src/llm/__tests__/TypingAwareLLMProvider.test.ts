import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { describe, expect, it, vi } from "vitest";
import type { EventContext, NostrPublisher } from "../../agents/core/types";
import { TypingAwareLLMProvider } from "../TypingAwareLLMProvider";
import type { LLMContext, LLMMessage, LLMProvider, LLMResponse } from "../types";

describe("TypingAwareLLMProvider", () => {
    it("should publish typing indicators with actual system and user prompts", async () => {
        // Create mocks
        const mockBaseProvider: LLMProvider = {
            generateResponse: vi.fn().mockResolvedValue({
                content: "Test response",
                model: "test-model",
            } as LLMResponse),
        };

        const mockPublisher: NostrPublisher = {
            publishResponse: vi.fn(),
            publishTypingIndicator: vi.fn().mockResolvedValue(undefined),
        };

        const agentName = "test-agent";
        const signer = NDKPrivateKeySigner.generate();

        // Create the typing-aware provider
        const provider = new TypingAwareLLMProvider(
            mockBaseProvider,
            mockPublisher,
            agentName,
            signer
        );

        // Test messages
        const messages: LLMMessage[] = [
            {
                role: "system",
                content: "You are a helpful assistant with specific instructions for testing.",
            },
            {
                role: "user",
                content: "Please help me test the typing indicators.",
            },
        ];

        const context: LLMContext = {
            rootEventId: "test-convo",
            projectEvent: { dTag: "test-project" } as any,
            ndk: {} as any,
        };

        // Call the provider
        await provider.generateResponse(messages, {} as any, context);

        // Verify typing indicator was published with start
        expect(mockPublisher.publishTypingIndicator).toHaveBeenCalledWith(
            agentName,
            true,
            expect.objectContaining({
                rootEventId: "test-convo",
                projectId: "test-project",
            }),
            signer,
            expect.objectContaining({
                systemPrompt: expect.stringContaining("You are a helpful assistant"),
                userPrompt: expect.stringContaining("Please help me test"),
            })
        );

        // Verify typing indicator was published with stop
        expect(mockPublisher.publishTypingIndicator).toHaveBeenCalledWith(
            agentName,
            false,
            expect.objectContaining({
                rootEventId: "test-convo",
                projectId: "test-project",
            }),
            signer
        );

        // Verify it was called exactly twice (start and stop)
        expect(mockPublisher.publishTypingIndicator).toHaveBeenCalledTimes(2);
    });

    it("should not publish typing indicators when context is missing", async () => {
        // Create mocks
        const mockBaseProvider: LLMProvider = {
            generateResponse: vi.fn().mockResolvedValue({
                content: "Test response",
                model: "test-model",
            } as LLMResponse),
        };

        const mockPublisher: NostrPublisher = {
            publishResponse: vi.fn(),
            publishTypingIndicator: vi.fn(),
        };

        const provider = new TypingAwareLLMProvider(
            mockBaseProvider,
            mockPublisher,
            "test-agent",
            NDKPrivateKeySigner.generate()
        );

        // Call without proper context
        await provider.generateResponse(
            [{ role: "user", content: "Test" }],
            {} as any,
            {} // Missing required context fields
        );

        // Verify typing indicator was NOT published
        expect(mockPublisher.publishTypingIndicator).not.toHaveBeenCalled();
    });
});
