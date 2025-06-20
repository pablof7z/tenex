#!/usr/bin/env bun
import { createDebugAgentSystem } from './src/debug/createDebugAgentSystem';
import { logInfo, logError } from '@tenex/shared/logger';

async function testDebugSystem() {
  try {
    logInfo('Testing debug agent system...');
    
    // Create debug agent system
    const { agent, llmService } = await createDebugAgentSystem({
      projectPath: process.cwd(),
      agentName: 'planner'
    });
    
    logInfo(`Created debug agent: ${agent.getName()}`);
    
    // Test sending a message
    const response = await agent.sendMessage('Hello! Can you tell me about yourself and what tools you have available?');
    
    console.log('\n=== Agent Response ===');
    console.log(response.message);
    console.log('===================\n');
    
    // Test system prompt
    console.log('\n=== System Prompt ===');
    console.log(agent.getSystemPrompt());
    console.log('===================\n');
    
    logInfo('Debug system test completed successfully!');
  } catch (error) {
    logError('Debug system test failed:', error);
    process.exit(1);
  }
}

testDebugSystem();