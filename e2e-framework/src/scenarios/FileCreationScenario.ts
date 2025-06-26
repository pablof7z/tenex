import { BaseScenario } from '../BaseScenario';
import { expect } from 'bun:test';

export class FileCreationScenario extends BaseScenario {
  name = 'File Creation Test';
  description = 'Tests basic file creation by coder agent';
  
  async run(): Promise<void> {
    console.log('Creating project...');
    // Create project with coder agent
    const project = await this.orchestrator.createProject({
      name: 'file-test',
      description: 'Test project for file creation',
      agents: ['coder'],
      instructions: ['be-concise']
    });
    
    console.log('Starting conversation...');
    // Start conversation and request file creation
    const conversation = await project.startConversation({
      message: '@coder create a file called test.txt with the content "Hello World"',
      title: 'File Creation Test'
    });
    
    // Give the daemon a moment to process the message
    console.log('Waiting for daemon to process message...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Waiting for file creation...');
    // Wait for the file to be created
    await project.waitForFile('test.txt', {
      content: 'Hello World',
      timeout: 30000
    });
    
    console.log('Reading file content...');
    // Verify file content
    const content = await project.readFile('test.txt');
    expect(content).toContain('Hello World');
    
    console.log('Waiting for completion message...');
    // Wait for completion message
    await conversation.waitForCompletion({
      timeout: 20000,
      indicators: ['created', 'done', 'complete', 'finished']
    });
  }
}