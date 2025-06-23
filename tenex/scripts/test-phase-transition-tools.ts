#!/usr/bin/env tsx

/**
 * Test script to verify phase transitions via tool calls
 */

import { logger } from "../src/utils/logger";
import { ToolDetector } from "../src/tools/execution/ToolDetector";
import { PhaseTransitionExecutor } from "../src/tools/execution/executors/PhaseTransitionExecutor";
import type { ToolInvocation, ToolExecutionContext } from "../src/tools/types";

// Test tool detection
async function testToolDetection() {
    const detector = new ToolDetector();
    
    const testCases = [
        {
            content: "I understand you want to build a CLI. Let me help you with that.\n\n<phase_transition>execute</phase_transition>",
            expectedTool: "phase_transition",
            expectedPhase: "execute"
        },
        {
            content: "Let me create a detailed plan for your system.\n\n<phase_transition>plan</phase_transition>",
            expectedTool: "phase_transition",
            expectedPhase: "plan"
        },
        {
            content: "I'll review your code now.\n\n<phase_transition>review</phase_transition>",
            expectedTool: "phase_transition",
            expectedPhase: "review"
        },
        {
            content: "This is a normal response without phase transition.",
            expectedTool: null,
            expectedPhase: null
        }
    ];

    logger.info("Testing phase transition tool detection...");

    for (const testCase of testCases) {
        const invocations = detector.detectTools(testCase.content);
        const phaseTransition = invocations.find(i => i.toolName === "phase_transition");
        
        const passed = (phaseTransition?.toolName === testCase.expectedTool || (!phaseTransition && !testCase.expectedTool)) &&
                      (phaseTransition?.parameters.phase === testCase.expectedPhase || (!phaseTransition && !testCase.expectedPhase));

        logger.info(`Test ${passed ? 'PASSED' : 'FAILED'}:`, {
            input: testCase.content.substring(0, 50) + "...",
            foundTool: phaseTransition?.toolName || null,
            foundPhase: phaseTransition?.parameters.phase || null,
            expectedTool: testCase.expectedTool,
            expectedPhase: testCase.expectedPhase
        });
    }
}

// Test tool execution
async function testToolExecution() {
    logger.info("\nTesting phase transition tool execution...");
    
    const executor = new PhaseTransitionExecutor();
    const context: ToolExecutionContext = {
        projectPath: "/test/project",
        conversationId: "test-conversation",
        agentName: "TestAgent",
        phase: "chat"
    };

    const testInvocations: ToolInvocation[] = [
        {
            toolName: "phase_transition",
            action: "transition",
            parameters: { phase: "execute" },
            rawMatch: "<phase_transition>execute</phase_transition>"
        },
        {
            toolName: "phase_transition",
            action: "transition",
            parameters: { phase: "invalid" },
            rawMatch: "<phase_transition>invalid</phase_transition>"
        },
        {
            toolName: "phase_transition",
            action: "transition",
            parameters: {},
            rawMatch: "<phase_transition></phase_transition>"
        }
    ];

    for (const invocation of testInvocations) {
        const result = await executor.execute(invocation, context);
        logger.info(`Execution result:`, {
            phase: invocation.parameters.phase || "undefined",
            success: result.success,
            output: result.output,
            error: result.error,
            metadata: result.metadata
        });
    }
}

// Test complete flow
async function testCompleteFlow() {
    logger.info("\nTesting complete phase transition flow...");
    
    const agentResponse = `Based on your request to build a hello world CLI, I understand what you need.

<phase_transition>execute</phase_transition>

I'll now help you implement this.`;

    // 1. Detect tools
    const detector = new ToolDetector();
    const invocations = detector.detectTools(agentResponse);
    logger.info("Detected invocations:", invocations);

    // 2. Clean response
    const cleanedResponse = detector.cleanResponse(agentResponse, invocations);
    logger.info("Cleaned response:", cleanedResponse);

    // 3. Execute tool
    const executor = new PhaseTransitionExecutor();
    const context: ToolExecutionContext = {
        projectPath: "/test/project",
        conversationId: "test-conversation",
        agentName: "ProjectAgent",
        phase: "chat"
    };

    const phaseTransition = invocations.find(i => i.toolName === "phase_transition");
    if (phaseTransition) {
        const result = await executor.execute(phaseTransition, context);
        logger.info("Tool execution result:", result);
        
        // 4. Extract phase from metadata
        const requestedPhase = result.metadata?.requestedPhase;
        logger.info("Phase to transition to:", requestedPhase);
    }
}

// Main
async function main() {
    logger.info("Starting phase transition tool tests...\n");
    
    await testToolDetection();
    await testToolExecution();
    await testCompleteFlow();
    
    logger.info("\nPhase transition tool tests completed!");
    
    logger.info("\nTo test with the actual system:");
    logger.info("1. Start a conversation in chat phase");
    logger.info("2. The agent should use <phase_transition>execute</phase_transition> when asked to build");
    logger.info("3. The system should transition to execute phase automatically");
}

main().catch((error) => {
    logger.error("Test failed:", error);
    process.exit(1);
});