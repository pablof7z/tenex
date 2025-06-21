import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { initNDK, getNDK } from "@/nostr/ndkClient";
import { AgentRegistry } from "@/agents";
import { ConversationManager } from "@/conversations";
import { ConversationRouter, RoutingLLM } from "@/routing";
import { LLMConfigManager, LLMService } from "@/llm";
import { ConversationPublisher } from "@/nostr";
import { EventHandler } from "@/commands/run/EventHandler";
import { initializeProjectContext } from "@/runtime";
import { createConversationEvent, createReplyEvent, createProjectEvent } from "@/test-utils/mocks/events";
import { MockLLMProvider } from "@/llm/providers/MockProvider";
import type { ProjectRuntimeInfo } from "@/commands/run/ProjectLoader";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("E2E: Complete Conversation Flow", () => {
  let testDir: string;
  let eventHandler: EventHandler;
  let projectInfo: ProjectRuntimeInfo;
  let mockLLMProvider: MockLLMProvider;

  beforeEach(async () => {
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "tenex-e2e-"));

    // Initialize NDK with mock
    await initNDK();

    // Set up project
    const projectSigner = NDKPrivateKeySigner.generate();
    const projectEvent = createProjectEvent("test-project", "Test Project");
    projectEvent.pubkey = projectSigner.pubkey;

    // Create agents
    const developerSigner = NDKPrivateKeySigner.generate();
    const reviewerSigner = NDKPrivateKeySigner.generate();

    projectInfo = {
      projectPath: testDir,
      projectEvent,
      projectSigner,
      agents: new Map([
        ["developer", {
          name: "Developer",
          role: "Software Developer",
          instructions: "You write code and implement features",
          pubkey: developerSigner.pubkey,
          signer: developerSigner,
          eventId: "dev-event-123",
        }],
        ["reviewer", {
          name: "Reviewer",
          role: "Code Reviewer",
          instructions: "You review code and suggest improvements",
          pubkey: reviewerSigner.pubkey,
          signer: reviewerSigner,
          eventId: "rev-event-123",
        }],
      ]),
      title: "Test Project",
      repository: undefined,
    };

    // Set up mock LLM
    await setupMockLLM();

    // Initialize event handler
    eventHandler = new EventHandler(projectInfo);
    await eventHandler.initialize();
  });

  afterEach(async () => {
    await eventHandler.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  async function setupMockLLM() {
    // Create llms.json
    const llmConfig = {
      default: {
        provider: "mock",
        model: "mock-model",
        temperature: 0.7,
      },
      routing: {
        provider: "mock",
        model: "mock-router",
        temperature: 0.3,
      },
    };

    await fs.writeFile(
      path.join(testDir, "llms.json"),
      JSON.stringify(llmConfig, null, 2)
    );

    // Set up mock provider
    mockLLMProvider = new MockLLMProvider();
    
    // Override LLM service creation to use our mock
    const originalCreateProvider = LLMService.prototype.createProvider;
    LLMService.prototype.createProvider = function() {
      return mockLLMProvider;
    };
  }

  describe("Full Conversation Lifecycle", () => {
    it("should handle conversation from chat through review phase", async () => {
      // Phase 1: CHAT - User starts conversation
      const userSigner = NDKPrivateKeySigner.generate();
      const conversationStart = createConversationEvent(
        "conv-e2e-1",
        "I want to build a simple TODO app with Node.js",
        "TODO App Project"
      );
      conversationStart.pubkey = userSigner.pubkey;

      // Configure routing response
      mockLLMProvider.setResponse({
        content: JSON.stringify({
          selectedAgent: "Developer",
          reasoning: "User wants to build an app, needs development help",
          confidence: 0.9,
          phase: "chat",
        }),
        model: "mock-router",
      });

      // Process initial event
      await eventHandler.handleEvent(conversationStart);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Configure developer response
      mockLLMProvider.setResponse({
        content: "I'll help you build a TODO app with Node.js. Let me understand your requirements first. Do you want a REST API or a full-stack application?",
        model: "mock-model",
      });

      // Verify conversation was created and agent responded
      const convManager = (eventHandler as any).conversationManager;
      const conversation = convManager.getConversation("conv-e2e-1");
      expect(conversation).toBeDefined();
      expect(conversation.phase).toBe("chat");
      expect(conversation.currentAgent).toBe(projectInfo.agents.get("developer")?.pubkey);

      // Phase 2: User provides more details
      const userReply = createReplyEvent(
        "conv-e2e-1",
        "I want a REST API with endpoints for creating, reading, updating, and deleting todos. Use Express.js and store data in memory for now.",
        userSigner.pubkey
      );

      mockLLMProvider.setResponse({
        content: "Great! I understand you want a REST API for a TODO app. Let me create a plan for this project.",
        model: "mock-model",
      });

      await eventHandler.handleEvent(userReply);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Phase 3: PLAN - Transition to planning
      // Configure routing for phase transition
      mockLLMProvider.setResponse({
        content: JSON.stringify({
          selectedAgent: "Developer",
          reasoning: "Developer can create the implementation plan",
          confidence: 0.95,
          nextPhase: "plan",
          phaseContext: "Create implementation plan for TODO REST API",
        }),
        model: "mock-router",
      });

      // Simulate phase transition (in real system, this would be triggered by agent or user)
      const router = (eventHandler as any).conversationRouter as ConversationRouter;
      await router.transitionPhase("conv-e2e-1", "plan");

      // Configure planning response
      mockLLMProvider.setResponse({
        content: `## TODO REST API Implementation Plan

### 1. Project Setup
- Initialize Node.js project
- Install Express and required dependencies
- Set up project structure

### 2. Data Model
- Define Todo interface
- Implement in-memory storage

### 3. API Endpoints
- POST /todos - Create new todo
- GET /todos - List all todos
- GET /todos/:id - Get specific todo
- PUT /todos/:id - Update todo
- DELETE /todos/:id - Delete todo

### 4. Middleware
- JSON body parser
- Error handling
- Request validation

### 5. Testing
- Set up test framework
- Write endpoint tests`,
        model: "mock-model",
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify plan phase
      const updatedConv = convManager.getConversation("conv-e2e-1");
      expect(updatedConv.phase).toBe("plan");

      // Phase 4: EXECUTE - Implementation
      mockLLMProvider.setResponse({
        content: JSON.stringify({
          selectedAgent: "Developer",
          reasoning: "Developer will implement the planned API",
          confidence: 0.98,
          nextPhase: "execute",
          phaseContext: "Implement the TODO REST API according to plan",
        }),
        model: "mock-router",
      });

      await router.transitionPhase("conv-e2e-1", "execute");

      // Configure execution response with tools
      mockLLMProvider.setResponse({
        content: `I'll implement the TODO REST API now.

First, let me initialize the project:
<execute>npm init -y</execute>

Now installing dependencies:
<execute>npm install express cors</execute>
<execute>npm install -D @types/node @types/express typescript nodemon</execute>

Creating the main server file:
<write file="server.js">
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
let todos = [];
let nextId = 1;

// Routes
app.post('/todos', (req, res) => {
  const { title, completed = false } = req.body;
  const todo = { id: nextId++, title, completed };
  todos.push(todo);
  res.status(201).json(todo);
});

app.get('/todos', (req, res) => {
  res.json(todos);
});

app.get('/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === parseInt(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Todo not found' });
  res.json(todo);
});

app.put('/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });
  
  todos[index] = { ...todos[index], ...req.body };
  res.json(todos[index]);
});

app.delete('/todos/:id', (req, res) => {
  const index = todos.findIndex(t => t.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Todo not found' });
  
  todos.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
</write>

The TODO REST API is now implemented!`,
        model: "mock-model",
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify execute phase
      const execConv = convManager.getConversation("conv-e2e-1");
      expect(execConv.phase).toBe("execute");

      // Phase 5: REVIEW - Code review
      mockLLMProvider.setResponse({
        content: JSON.stringify({
          selectedAgent: "Reviewer",
          reasoning: "Time for code review after implementation",
          confidence: 0.92,
          nextPhase: "review",
          phaseContext: "Review the implemented TODO REST API",
        }),
        model: "mock-router",
      });

      await router.transitionPhase("conv-e2e-1", "review");

      // Configure review response
      mockLLMProvider.setResponse({
        content: `## Code Review Summary

### ✅ Strengths
- Clean and simple implementation
- Proper HTTP status codes
- Good endpoint structure following REST conventions
- Error handling for not found cases

### 📝 Suggestions for Improvement
1. **Input Validation**: Add validation for todo title (required, non-empty)
2. **Error Handling**: Add global error handler middleware
3. **Documentation**: Add API documentation/comments
4. **Testing**: Implement unit tests for the endpoints
5. **Type Safety**: Consider migrating to TypeScript

### 🎯 Overall Assessment
The implementation successfully meets the requirements for a basic TODO REST API. The code is functional and follows good practices for a simple in-memory solution.

**Rating: 8/10** - Good implementation for the specified requirements.`,
        model: "mock-model",
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify review phase
      const finalConv = convManager.getConversation("conv-e2e-1");
      expect(finalConv.phase).toBe("review");

      // Verify conversation history
      expect(finalConv.history.length).toBeGreaterThan(4);
      
      // Verify metadata
      expect(finalConv.metadata).toBeDefined();
      expect(finalConv.metadata.chat_summary).toBeDefined();
    });

    it("should handle errors gracefully during conversation", async () => {
      // Start conversation
      const conversationStart = createConversationEvent(
        "conv-error-test",
        "Help me with an error",
        "Error Test"
      );

      // Configure routing to fail
      mockLLMProvider.setThrowError(new Error("LLM Service Unavailable"));

      await eventHandler.handleEvent(conversationStart);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Conversation should be created but no agent assigned
      const convManager = (eventHandler as any).conversationManager;
      const conversation = convManager.getConversation("conv-error-test");
      
      // Depending on error handling implementation
      expect(conversation).toBeDefined();
      expect(conversation.currentAgent).toBeUndefined();
    });
  });

  describe("Persistence Across Restarts", () => {
    it("should resume conversation after system restart", async () => {
      // Create initial conversation
      const conversationStart = createConversationEvent(
        "conv-persist-1",
        "Start of conversation",
        "Persistence Test"
      );

      mockLLMProvider.setResponse({
        content: JSON.stringify({
          selectedAgent: "Developer",
          reasoning: "Test",
          confidence: 0.9,
          phase: "chat",
        }),
        model: "mock-router",
      });

      await eventHandler.handleEvent(conversationStart);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Save conversation state
      await eventHandler.cleanup();

      // Simulate system restart
      const newEventHandler = new EventHandler(projectInfo);
      await newEventHandler.initialize();

      // Verify conversation was loaded
      const convManager = (newEventHandler as any).conversationManager;
      const loadedConv = convManager.getConversation("conv-persist-1");
      
      expect(loadedConv).toBeDefined();
      expect(loadedConv.title).toBe("Persistence Test");
      expect(loadedConv.phase).toBe("chat");

      await newEventHandler.cleanup();
    });
  });
});