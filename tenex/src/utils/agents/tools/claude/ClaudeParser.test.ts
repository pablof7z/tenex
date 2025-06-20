import { describe, it, expect, vi } from "vitest";
import { ClaudeParser } from "./ClaudeParser";
import type { ClaudeCodeMessage } from "../claudeCode/types";

describe("ClaudeParser", () => {
    it("should parse JSON lines correctly", () => {
        const parser = new ClaudeParser();
        const data = `{"type":"system","message":"Starting"}\n{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}\n`;

        const messages = parser.parseLines(data);

        expect(messages).toHaveLength(2);
        expect(messages[0].type).toBe("system");
        expect(messages[1].type).toBe("assistant");
    });

    it("should handle partial lines with buffering", () => {
        const parser = new ClaudeParser();
        
        // First chunk ends mid-JSON
        const chunk1 = `{"type":"system","message":"Start`;
        const messages1 = parser.parseLines(chunk1);
        expect(messages1).toHaveLength(0);

        // Second chunk completes the JSON
        const chunk2 = `ing"}\n{"type":"assistant"}\n`;
        const messages2 = parser.parseLines(chunk2);
        expect(messages2).toHaveLength(2);
        expect(messages2[0].type).toBe("system");
        expect(messages2[1].type).toBe("assistant");
    });

    it("should capture session ID", () => {
        const parser = new ClaudeParser();
        const data = `{"type":"assistant","session_id":"test-session-123"}\n`;

        parser.parseLines(data);

        expect(parser.getSessionId()).toBe("test-session-123");
    });

    it("should only capture session ID once", () => {
        const parser = new ClaudeParser();
        const data = `{"type":"assistant","session_id":"first-id"}\n{"type":"assistant","session_id":"second-id"}\n`;

        parser.parseLines(data);

        expect(parser.getSessionId()).toBe("first-id");
    });

    it("should track costs", () => {
        const parser = new ClaudeParser();
        const data = `{"type":"assistant","cost_usd":0.5}\n{"type":"result","total_cost":1.5}\n`;

        parser.parseLines(data);

        expect(parser.getTotalCost()).toBe(2.0);
    });

    it("should count assistant messages", () => {
        const parser = new ClaudeParser();
        const data = `{"type":"assistant"}\n{"type":"system"}\n{"type":"assistant"}\n{"type":"user"}\n`;

        parser.parseLines(data);

        expect(parser.getMessageCount()).toBe(2);
    });

    it("should call onMessage handler for each parsed message", async () => {
        const handler = vi.fn();
        const parser = new ClaudeParser(handler);
        const data = `{"type":"system"}\n{"type":"assistant"}\n`;

        parser.parseLines(data);

        // Wait for async handlers
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenCalledWith({ type: "system" });
        expect(handler).toHaveBeenCalledWith({ type: "assistant" });
    });

    it("should handle invalid JSON gracefully", () => {
        const parser = new ClaudeParser();
        const data = `invalid json\n{"type":"valid"}\n`;

        const messages = parser.parseLines(data);

        expect(messages).toHaveLength(1);
        expect(messages[0].type).toBe("valid");
    });

    it("should track duration", async () => {
        const parser = new ClaudeParser();
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const duration = parser.getDuration();
        expect(duration).toBeGreaterThanOrEqual(50);
        expect(duration).toBeLessThan(200); // Should complete quickly
    });

    it("should handle empty lines", () => {
        const parser = new ClaudeParser();
        const data = `\n\n{"type":"assistant"}\n\n\n`;

        const messages = parser.parseLines(data);

        expect(messages).toHaveLength(1);
        expect(messages[0].type).toBe("assistant");
    });

    it("should handle onMessage errors gracefully", async () => {
        const errorHandler = vi.fn(() => {
            throw new Error("Handler error");
        });
        const parser = new ClaudeParser(errorHandler);
        const data = `{"type":"assistant"}\n`;

        // Should not throw
        expect(() => parser.parseLines(data)).not.toThrow();

        // Wait for async handlers
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(errorHandler).toHaveBeenCalled();
    });

    it("should parse complex message with all fields", () => {
        const parser = new ClaudeParser();
        const complexMessage: ClaudeCodeMessage = {
            type: "assistant",
            message: {
                id: "msg_123",
                type: "message",
                role: "assistant",
                model: "claude-3",
                content: [{ type: "text", text: "Hello world" }],
                stop_reason: null,
                stop_sequence: null,
                usage: {
                    input_tokens: 100,
                    cache_read_input_tokens: 50,
                    output_tokens: 20,
                    service_tier: "standard"
                }
            },
            session_id: "session_123",
            cost_usd: 0.002
        };

        const data = JSON.stringify(complexMessage) + "\n";
        const messages = parser.parseLines(data);

        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual(complexMessage);
        expect(parser.getSessionId()).toBe("session_123");
        expect(parser.getTotalCost()).toBe(0.002);
        expect(parser.getMessageCount()).toBe(1);
    });
});