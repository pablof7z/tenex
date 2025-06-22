import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { AgentRegistry } from "../AgentRegistry";
import type { Agent, AgentConfig } from "@/agents/types";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { fileExists, readFile, writeJsonFile, ensureDirectory } from "@/lib/fs";
import path from "node:path";

// Mock file system
jest.mock("@/lib/fs");

describe("AgentRegistry", () => {
  let registry: AgentRegistry;
  const testProjectPath = "/test/project";
  const agentsPath = path.join(testProjectPath, "agents.json");
  const agentsDir = path.join(testProjectPath, ".tenex", "agents");

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new AgentRegistry(testProjectPath);
  });

  describe("loadFromProject", () => {
    it("should load agents from agents.json", async () => {
      const mockAgentsData = {
        developer: {
          name: "Developer",
          role: "Software Developer",
          expertise: "Full-stack development",
          instructions: "Write clean code",
          nsec: "nsec1test",
          tools: ["shell", "file"],
          llmConfig: "default",
        },
        reviewer: {
          name: "Reviewer",
          role: "Code Reviewer",
          expertise: "Code quality",
          instructions: "Review code thoroughly",
          nsec: "nsec2test",
          tools: ["file"],
          llmConfig: "fast",
        },
      };

      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockAgentsData)),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();

      expect(fileExists).toHaveBeenCalledWith(agentsPath);
      expect(readFile).toHaveBeenCalledWith(agentsPath, "utf-8");

      const developer = await registry.getAgent("developer");
      expect(developer).toBeDefined();
      expect(developer?.name).toBe("Developer");
      expect(developer?.role).toBe("Software Developer");
      expect(developer?.tools).toEqual(["shell", "file"]);

      const reviewer = await registry.getAgent("reviewer");
      expect(reviewer).toBeDefined();
      expect(reviewer?.name).toBe("Reviewer");
      expect(reviewer?.role).toBe("Code Reviewer");
    });

    it("should create agents.json if it doesn't exist", async () => {
      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(false),
        readFile: jest.fn(),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();

      expect(fileExists).toHaveBeenCalledWith(agentsPath);
      expect(writeJsonFile).toHaveBeenCalledWith(agentsPath, {});
      expect(readFile).not.toHaveBeenCalled();
    });

    it("should handle invalid JSON in agents.json", async () => {
      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue("invalid json"),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await expect(registry.loadFromProject()).rejects.toThrow();
    });
  });

  describe("ensureAgent", () => {
    beforeEach(async () => {
      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(false),
        readFile: jest.fn(),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();
    });

    it("should create a new agent if it doesn't exist", async () => {
      const config: AgentConfig = {
        name: "TestAgent",
        role: "Tester",
        expertise: "Testing",
        instructions: "Test everything",
        nsec: "",
        tools: ["shell"],
        llmConfig: "default",
      };

      const agent = await registry.ensureAgent("tester", config);

      expect(agent).toBeDefined();
      expect(agent.name).toBe("TestAgent");
      expect(agent.role).toBe("Tester");
      expect(agent.signer).toBeDefined();
      expect(agent.pubkey).toBeDefined();
      expect(writeJsonFile).toHaveBeenCalled();
    });

    it("should generate nsec if not provided", async () => {
      const config: AgentConfig = {
        name: "TestAgent",
        role: "Tester",
        expertise: "Testing",
        instructions: "Test everything",
        nsec: "", // Empty nsec
        tools: [],
      };

      const agent = await registry.ensureAgent("tester", config);

      expect(agent.signer).toBeDefined();
      expect(agent.signer.privateKey).toBeDefined();
      expect(agent.pubkey).toBe(agent.signer.pubkey);
    });

    it("should use provided nsec", async () => {
      const signer = NDKPrivateKeySigner.generate();
      const config: AgentConfig = {
        name: "TestAgent",
        role: "Tester",
        expertise: "Testing",
        instructions: "Test everything",
        nsec: signer.privateKey!,
        tools: [],
      };

      const agent = await registry.ensureAgent("tester", config);

      expect(agent.signer.privateKey).toBe(signer.privateKey);
      expect(agent.pubkey).toBe(signer.pubkey);
    });

    it("should return existing agent if already registered", async () => {
      const config: AgentConfig = {
        name: "TestAgent",
        role: "Tester",
        expertise: "Testing",
        instructions: "Test everything",
        nsec: "",
        tools: [],
      };

      const agent1 = await registry.ensureAgent("tester", config);
      
      // Clear write mock to check it's not called again
      (writeJsonFile as jest.Mock).mockClear();
      
      const agent2 = await registry.ensureAgent("tester", config);

      expect(agent1).toBe(agent2);
      expect(writeJsonFile).not.toHaveBeenCalled();
    });

    it("should save agent configuration to disk", async () => {
      const config: AgentConfig = {
        name: "TestAgent",
        role: "Tester",
        expertise: "Testing",
        instructions: "Test everything",
        nsec: "",
        tools: ["shell", "file"],
        llmConfig: "fast",
      };

      await registry.ensureAgent("tester", config);

      expect(writeJsonFile).toHaveBeenCalledWith(
        agentsPath,
        expect.objectContaining({
          tester: expect.objectContaining({
            name: "TestAgent",
            role: "Tester",
            expertise: "Testing",
            instructions: "Test everything",
            tools: ["shell", "file"],
            llmConfig: "fast",
          }),
        })
      );
    });
  });

  describe("getAgent", () => {
    beforeEach(async () => {
      const mockAgentsData = {
        developer: {
          name: "Developer",
          role: "Software Developer",
          expertise: "Full-stack development",
          instructions: "Write clean code",
          nsec: NDKPrivateKeySigner.generate().privateKey,
          tools: ["shell"],
        },
      };

      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockAgentsData)),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();
    });

    it("should return agent by name", async () => {
      const agent = await registry.getAgent("developer");

      expect(agent).toBeDefined();
      expect(agent?.name).toBe("Developer");
      expect(agent?.role).toBe("Software Developer");
    });

    it("should return undefined for non-existent agent", async () => {
      const agent = await registry.getAgent("nonexistent");

      expect(agent).toBeUndefined();
    });
  });

  describe("getAllAgents", () => {
    it("should return all registered agents", async () => {
      const mockAgentsData = {
        developer: {
          name: "Developer",
          role: "Software Developer",
          expertise: "Full-stack development",
          instructions: "Write clean code",
          nsec: NDKPrivateKeySigner.generate().privateKey,
        },
        reviewer: {
          name: "Reviewer",
          role: "Code Reviewer",
          expertise: "Code quality",
          instructions: "Review code",
          nsec: NDKPrivateKeySigner.generate().privateKey,
        },
      };

      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockAgentsData)),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();

      const agents = await registry.getAllAgents();

      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.name)).toContain("Developer");
      expect(agents.map(a => a.name)).toContain("Reviewer");
    });

    it("should return empty array when no agents exist", async () => {
      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(false),
        readFile: jest.fn(),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();

      const agents = await registry.getAllAgents();

      expect(agents).toHaveLength(0);
    });
  });

  describe("removeAgent", () => {
    beforeEach(async () => {
      const mockAgentsData = {
        developer: {
          name: "Developer",
          role: "Software Developer",
          expertise: "Full-stack development",
          instructions: "Write clean code",
          nsec: NDKPrivateKeySigner.generate().privateKey,
        },
      };

      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockAgentsData)),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();
    });

    it("should remove agent from registry", async () => {
      let agent = await registry.getAgent("developer");
      expect(agent).toBeDefined();

      await registry.removeAgent("developer");

      agent = await registry.getAgent("developer");
      expect(agent).toBeUndefined();
      expect(writeJsonFile).toHaveBeenCalled();
    });

    it("should handle removing non-existent agent", async () => {
      await expect(registry.removeAgent("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("updateAgent", () => {
    beforeEach(async () => {
      const mockAgentsData = {
        developer: {
          name: "Developer",
          role: "Software Developer",
          expertise: "Full-stack development",
          instructions: "Write clean code",
          nsec: NDKPrivateKeySigner.generate().privateKey,
          tools: ["shell"],
        },
      };

      mock.module("@/lib/fs", () => ({
        fileExists: jest.fn().mockResolvedValue(true),
        readFile: jest.fn().mockResolvedValue(JSON.stringify(mockAgentsData)),
        writeJsonFile: jest.fn(),
        ensureDirectory: jest.fn(),
      }));

      await registry.loadFromProject();
    });

    it("should update existing agent", async () => {
      const updates: Partial<AgentConfig> = {
        role: "Senior Developer",
        tools: ["shell", "file", "api"],
        llmConfig: "advanced",
      };

      await registry.updateAgent("developer", updates);

      const agent = await registry.getAgent("developer");
      expect(agent?.role).toBe("Senior Developer");
      expect(agent?.tools).toEqual(["shell", "file", "api"]);
      expect(agent?.llmConfig).toBe("advanced");
      expect(writeJsonFile).toHaveBeenCalled();
    });

    it("should throw when updating non-existent agent", async () => {
      await expect(
        registry.updateAgent("nonexistent", { role: "Test" })
      ).rejects.toThrow("Agent 'nonexistent' not found");
    });
  });
});