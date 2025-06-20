import { describe, it, expect, vi } from "vitest";
import { ClaudeParser } from "./ClaudeParser";
import type { ClaudeCodeMessage } from "../claudeCode/types";

describe("ClaudeParser Integration", () => {
    it("should handle real Claude CLI output stream", async () => {
        const publishedUpdates: string[] = [];
        let sessionId: string | undefined;
        
        // Mock publish function
        const mockPublish = vi.fn(async (content: string, sid?: string) => {
            publishedUpdates.push(content);
            if (sid) sessionId = sid;
        });

        // Create parser with handler that mimics claude_code tool
        const parser = new ClaudeParser(async (message: ClaudeCodeMessage) => {
            switch (message.type) {
                case "assistant":
                    if (message.message?.content) {
                        for (const content of message.message.content) {
                            if (content.type === "text" && content.text) {
                                await mockPublish(
                                    `🤖 **Claude Code**: ${content.text.trim()}`,
                                    parser.getSessionId()
                                );
                            }
                        }
                    }
                    break;
                    
                case "tool_use":
                    if (message.tool_use) {
                        const toolName = message.tool_use.name || "tool";
                        await mockPublish(
                            `🔧 **Tool Use**: Using ${toolName}...`,
                            parser.getSessionId()
                        );
                    }
                    break;
                    
                case "result":
                    if (message.is_error) {
                        await mockPublish(
                            "❌ **Task Failed**: Error occurred during execution",
                            parser.getSessionId()
                        );
                    } else {
                        await mockPublish(
                            "✅ **Task Complete**",
                            parser.getSessionId()
                        );
                    }
                    break;
            }
        });

        // Simulate Claude CLI output
        const stream = [
            `{"type":"system","message":"Initializing"}\n`,
            `{"type":"assistant","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-3","content":[{"type":"text","text":"Let me analyze the code"}],"usage":{"input_tokens":100,"output_tokens":10}},"session_id":"session-abc-123"}\n`,
            `{"type":"tool_use","tool_use":{"id":"tool_1","name":"read_file","input":{"path":"test.ts"}}}\n`,
            `{"type":"assistant","message":{"content":[{"type":"text","text":"Found the issue"}]}}\n`,
            `{"type":"result","result":"Fixed the bug successfully","cost_usd":0.005}\n`
        ];

        // Process stream
        for (const chunk of stream) {
            parser.parseLines(chunk);
        }

        // Wait for async handlers
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify results
        expect(parser.getSessionId()).toBe("session-abc-123");
        expect(parser.getMessageCount()).toBe(2); // Two assistant messages
        expect(parser.getTotalCost()).toBe(0.005);
        
        // Verify published updates
        expect(publishedUpdates).toContain("🤖 **Claude Code**: Let me analyze the code");
        expect(publishedUpdates).toContain("🔧 **Tool Use**: Using read_file...");
        expect(publishedUpdates).toContain("🤖 **Claude Code**: Found the issue");
        expect(publishedUpdates).toContain("✅ **Task Complete**");
        
        // Verify session ID was passed
        expect(sessionId).toBe("session-abc-123");
        expect(mockPublish).toHaveBeenCalledWith(
            expect.any(String),
            "session-abc-123"
        );
    });

    it("should handle research tool pattern", async () => {
        const publishedUpdates: string[] = [];
        
        // Create parser with handler that mimics research tool
        const parser = new ClaudeParser(async (message: ClaudeCodeMessage) => {
            switch (message.type) {
                case "assistant":
                    if (message.message?.content) {
                        for (const content of message.message.content) {
                            if (content.type === "text" && content.text) {
                                publishedUpdates.push(
                                    `🔍 **Research Progress**: ${content.text.substring(0, 200)}...`
                                );
                            }
                        }
                    }
                    break;
                    
                case "result":
                    if (message.is_error) {
                        publishedUpdates.push("❌ **Research Failed**: Error occurred during research");
                    } else {
                        publishedUpdates.push("✅ **Research Complete**: Report generated successfully");
                    }
                    break;
            }
        });

        // Simulate research output
        const chunk = `{"type":"assistant","message":{"content":[{"type":"text","text":"Analyzing the codebase architecture and identifying key patterns..."}]}}\n`;
        parser.parseLines(chunk);
        
        const result = `{"type":"result","result":"# Research Report\\n\\nDetailed analysis..."}\n`;
        parser.parseLines(result);

        // Wait for async handlers
        await new Promise(resolve => setTimeout(resolve, 10));

        // Verify
        expect(publishedUpdates).toHaveLength(2);
        expect(publishedUpdates[0]).toContain("Research Progress");
        expect(publishedUpdates[1]).toBe("✅ **Research Complete**: Report generated successfully");
    });
});