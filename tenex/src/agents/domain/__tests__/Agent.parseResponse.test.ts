import { describe, expect, it, beforeEach } from "vitest";
import { Agent } from "../Agent";
import type { AgentConfig } from "../../core/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

describe("Agent.parseResponse", () => {
    let agent: Agent;

    beforeEach(() => {
        const config: AgentConfig = {
            name: "test-agent",
            role: "Test Agent",
            instructions: "Test instructions",
            nsec: NDKPrivateKeySigner.generate().privateKey!,
        };

        // Create a minimal Agent instance to test the protected method
        agent = new (class extends Agent {
            public testParseResponse(content: string) {
                return this.parseResponse(content);
            }
        })(config, {} as any, {} as any, {} as any, {} as any);
    });

    describe("signal parsing", () => {
        it("should parse continue signal with reason", () => {
            const content = `Here is my response to the user.

I need more information to proceed.

SIGNAL: continue
REASON: awaiting user clarification`;

            const result = agent.testParseResponse(content);
            
            expect(result.content).toBe("Here is my response to the user.\n\nI need more information to proceed.");
            expect(result.signal).toEqual({
                type: "continue",
                reason: "awaiting user clarification"
            });
        });

        it("should parse signal without reason", () => {
            const content = `Task completed successfully!

SIGNAL: complete`;

            const result = agent.testParseResponse(content);
            
            expect(result.content).toBe("Task completed successfully!");
            expect(result.signal).toEqual({
                type: "complete"
            });
        });

        it("should parse blocked signal with agent list", () => {
            const content = `I've analyzed the requirements but need help.

SIGNAL: blocked
REASON: Need backend agent for API design and security agent for authentication strategy`;

            const result = agent.testParseResponse(content);
            
            expect(result.content).toBe("I've analyzed the requirements but need help.");
            expect(result.signal).toEqual({
                type: "blocked",
                reason: "Need backend agent for API design and security agent for authentication strategy"
            });
        });

        it("should handle uppercase signal types", () => {
            const content = `Ready to move on.

SIGNAL: READY_FOR_TRANSITION
REASON: Initial analysis complete`;

            const result = agent.testParseResponse(content);
            
            expect(result.signal).toEqual({
                type: "ready_for_transition",
                reason: "Initial analysis complete"
            });
        });

        it("should ignore invalid signal types", () => {
            const content = `Some content

SIGNAL: invalid_signal
REASON: test`;

            const result = agent.testParseResponse(content);
            
            expect(result.content).toBe(content);
            expect(result.signal).toBeUndefined();
        });

        it("should handle content with no signal", () => {
            const content = "Just a regular response without any signal";

            const result = agent.testParseResponse(content);
            
            expect(result.content).toBe(content);
            expect(result.signal).toBeUndefined();
        });

        it("should only match signal at the end of content", () => {
            const content = `Here's an example:
SIGNAL: continue
REASON: this is not a real signal

But this is the actual response.

SIGNAL: complete`;

            const result = agent.testParseResponse(content);
            
            expect(result.content).toBe(`Here's an example:
SIGNAL: continue
REASON: this is not a real signal

But this is the actual response.`);
            expect(result.signal).toEqual({
                type: "complete"
            });
        });

        it("should handle multi-line reasons", () => {
            const content = `Analysis done.

SIGNAL: blocked
REASON: Need help from multiple agents:
- Backend agent for API design
- Security agent for auth
- Database agent for schema`;

            const result = agent.testParseResponse(content);
            
            expect(result.signal).toEqual({
                type: "blocked",
                reason: "Need help from multiple agents:\n- Backend agent for API design\n- Security agent for auth\n- Database agent for schema"
            });
        });
    });
});