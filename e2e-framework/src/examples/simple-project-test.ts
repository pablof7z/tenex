/**
 * Simple example test demonstrating the e2e-framework usage
 * This shows how an LLM can write tests using the framework
 */

import { test, expect } from 'bun:test';
import { Orchestrator } from '../Orchestrator';

test('create project and send message', async () => {
  const orchestrator = new Orchestrator({
    // Use test relay if available, otherwise default public relays
    relays: ['wss://relay.damus.io'],
    // LLM config would go here for real tests
    // llmConfig: { provider: 'openai', model: 'gpt-4', apiKey: 'xxx' }
  });

  try {
    // Setup test environment
    await orchestrator.setup();
    
    // Create a new project
    const project = await orchestrator.createProject({
      name: 'test-project',
      description: 'A test project for e2e framework',
      agents: ['assistant'] // Would be actual agent names in real test
    });
    
    // Verify project was created
    expect(project.naddr).toMatch(/^naddr/);
    expect(project.name).toBe('test-project');
    
    // Start a conversation
    await project.startConversation({
      message: 'Hello, this is a test message',
      title: 'Test Conversation'
    });
    
    // In a real test, we would:
    // const conversation = await project.startConversation({...});
    // await conversation.waitForReply({ timeout: 30000 });
    
    console.log('✅ Test project created successfully!');
    console.log(`   NADDR: ${project.naddr}`);
    console.log(`   Directory: ${project.directory}`);
    
  } finally {
    // Always clean up
    await orchestrator.teardown();
  }
}, { timeout: 60000 }); // Give enough time for daemon startup