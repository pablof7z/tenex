import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import type { ProjectRuntimeInfo } from "../ProjectLoader";
import { StatusPublisher } from "../StatusPublisher";

// Mock the NDK client
mock.module("../../nostr/ndkClient", () => ({
    getNDK: () => ({
        // Mock NDK instance that doesn't actually publish
    }),
}));

// Mock the logger
mock.module("@tenex/shared/logger", () => ({
    logWarning: mock(() => {}),
}));

describe("StatusPublisher", () => {
    let statusPublisher: StatusPublisher;
    let tempDir: string;
    let projectPath: string;

    beforeEach(async () => {
        statusPublisher = new StatusPublisher();

        // Create temporary directory for test
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "status-publisher-test-"));
        projectPath = path.join(tempDir, "test-project");

        // Create .tenex directory
        const tenexDir = path.join(projectPath, ".tenex");
        await fs.mkdir(tenexDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should add model tags to status event from LLM configurations", async () => {
        // Create mock llms.json
        const llmsConfig = {
            "mock-gpt-4": {
                provider: "openai",
                model: "gpt-4",
                apiKey: "test-key",
                enableCaching: false,
            },
            "mock-claude": {
                provider: "anthropic",
                model: "claude-3-sonnet-20240229",
                apiKey: "test-key",
                enableCaching: true,
            },
            "mock-gemma": {
                provider: "ollama",
                model: "gemma:7b",
                enableCaching: false,
            },
            default: "mock-gpt-4",
        };

        await fs.writeFile(
            path.join(projectPath, ".tenex", "llms.json"),
            JSON.stringify(llmsConfig, null, 2)
        );

        // Create mock agents.json
        const agentsConfig = {
            default: {
                nsec: NDKPrivateKeySigner.generate().privateKey,
            },
            code: {
                nsec: NDKPrivateKeySigner.generate().privateKey,
            },
        };

        await fs.writeFile(
            path.join(projectPath, ".tenex", "agents.json"),
            JSON.stringify(agentsConfig, null, 2)
        );

        // Create mock project info
        const projectInfo = {
            title: "Test Project",
            projectPath,
            projectEvent: {
                encode: () => "test-project-ref",
            },
        };

        // Mock the NDK event
        let capturedTags: string[][] = [];
        let capturedContent = "";

        const mockEvent = {
            kind: 0,
            content: "",
            tags: [],
            tag: mock(() => {}),
            publish: mock(() => {}),
        };

        // Override the tags property to capture pushes
        Object.defineProperty(mockEvent, "tags", {
            get: () => capturedTags,
            set: (value) => {
                capturedTags = value;
            },
        });

        // Override the content property to capture content
        Object.defineProperty(mockEvent, "content", {
            get: () => capturedContent,
            set: (value) => {
                capturedContent = value;
            },
        });

        // Mock NDKEvent constructor
        const originalNDKEvent = globalThis.NDKEvent;
        globalThis.NDKEvent = mock(() => mockEvent) as unknown as typeof NDKEvent;

        try {
            // Call the method we're testing
            await statusPublisher.startPublishing(projectInfo as ProjectRuntimeInfo);

            // Parse the captured content
            const statusContent = JSON.parse(capturedContent);

            // Verify status content includes LLM configs
            expect(statusContent.status).toBe("online");
            expect(statusContent.project).toBe("Test Project");
            expect(statusContent.llmConfigs).toEqual(["mock-gpt-4", "mock-claude", "mock-gemma"]);

            // Verify model tags were added
            const modelTags = capturedTags.filter((tag) => tag[0] === "model");
            expect(modelTags).toHaveLength(3);

            // Check specific model tags
            expect(modelTags).toContainEqual(["model", "gpt-4", "mock-gpt-4"]);
            expect(modelTags).toContainEqual(["model", "claude-3-sonnet-20240229", "mock-claude"]);
            expect(modelTags).toContainEqual(["model", "gemma:7b", "mock-gemma"]);

            // Verify agent tags were added (p tags)
            const agentTags = capturedTags.filter((tag) => tag[0] === "p");
            expect(agentTags).toHaveLength(2); // default and code agents

            // Verify agent names are included in tags
            const agentNames = agentTags.map((tag) => tag[2]);
            expect(agentNames).toContain("default");
            expect(agentNames).toContain("code");
        } finally {
            // Restore original NDKEvent
            globalThis.NDKEvent = originalNDKEvent;
        }
    });

    it("should handle missing LLM configurations gracefully", async () => {
        // Create only agents.json, no llms.json
        const agentsConfig = {
            default: {
                nsec: NDKPrivateKeySigner.generate().privateKey,
            },
        };

        await fs.writeFile(
            path.join(projectPath, ".tenex", "agents.json"),
            JSON.stringify(agentsConfig, null, 2)
        );

        const projectInfo = {
            title: "Test Project",
            projectPath,
            projectEvent: {
                encode: () => "test-project-ref",
            },
        };

        let capturedTags: string[][] = [];
        let capturedContent = "";

        const mockEvent = {
            kind: 0,
            content: "",
            tags: [],
            tag: mock(() => {}),
            publish: mock(() => {}),
        };

        Object.defineProperty(mockEvent, "tags", {
            get: () => capturedTags,
            set: (value) => {
                capturedTags = value;
            },
        });

        Object.defineProperty(mockEvent, "content", {
            get: () => capturedContent,
            set: (value) => {
                capturedContent = value;
            },
        });

        const originalNDKEvent = globalThis.NDKEvent;
        globalThis.NDKEvent = mock(() => mockEvent) as unknown as typeof NDKEvent;

        try {
            await statusPublisher.startPublishing(projectInfo as ProjectRuntimeInfo);

            const statusContent = JSON.parse(capturedContent);

            // Should have empty LLM configs
            expect(statusContent.llmConfigs).toEqual([]);

            // Should have no model tags
            const modelTags = capturedTags.filter((tag) => tag[0] === "model");
            expect(modelTags).toHaveLength(0);

            // Should still have agent tags
            const agentTags = capturedTags.filter((tag) => tag[0] === "p");
            expect(agentTags).toHaveLength(1);
        } finally {
            globalThis.NDKEvent = originalNDKEvent;
        }
    });

    it("should handle string-based agent configurations", async () => {
        // Create agents.json with mixed string and object configs
        const agentsConfig = {
            default: NDKPrivateKeySigner.generate().privateKey, // string format
            code: {
                nsec: NDKPrivateKeySigner.generate().privateKey,
            },
        };

        await fs.writeFile(
            path.join(projectPath, ".tenex", "agents.json"),
            JSON.stringify(agentsConfig, null, 2)
        );

        const projectInfo = {
            title: "Test Project",
            projectPath,
            projectEvent: {
                encode: () => "test-project-ref",
            },
        };

        let capturedTags: string[][] = [];

        const mockEvent = {
            kind: 0,
            content: "",
            tags: [],
            tag: mock(() => {}),
            publish: mock(() => {}),
        };

        Object.defineProperty(mockEvent, "tags", {
            get: () => capturedTags,
            set: (value) => {
                capturedTags = value;
            },
        });

        const originalNDKEvent = globalThis.NDKEvent;
        globalThis.NDKEvent = mock(() => mockEvent) as unknown as typeof NDKEvent;

        try {
            await statusPublisher.startPublishing(projectInfo as ProjectRuntimeInfo);

            // Should handle both string and object agent configs
            const agentTags = capturedTags.filter((tag) => tag[0] === "p");
            expect(agentTags).toHaveLength(2);

            const agentNames = agentTags.map((tag) => tag[2]);
            expect(agentNames).toContain("default");
            expect(agentNames).toContain("code");
        } finally {
            globalThis.NDKEvent = originalNDKEvent;
        }
    });
});
