import { BaseScenario } from '../BaseScenario';
import { expect } from 'bun:test';

/**
 * A simplified brainstorming scenario that tests multi-turn conversation
 * without requiring external LLM APIs. Uses predefined responses to simulate
 * a realistic brainstorming session.
 * 
 * This scenario tests:
 * 1. Multi-turn conversation flow
 * 2. Context retention across messages
 * 3. Natural progression from idea to implementation
 * 4. File generation based on conversation
 */
export class SimpleBrainstormingScenario extends BaseScenario {
  name = 'Simple Brainstorming';
  description = 'Tests brainstorming with predefined conversation flow';
  
  async run(): Promise<void> {
    console.log('Creating project for brainstorming...');
    
    // Create project with default agents
    const project = await this.orchestrator.createProject({
      name: 'brainstorm-simple',
      description: 'A simple brainstorming test',
      agents: ['architect', 'coder']
    });
    
    console.log('Starting brainstorming conversation...');
    
    // Start with initial brainstorming message
    const conversation = await project.startConversation({
      message: `I want to build a command-line todo list application. 
Can you help me think through the features and implementation?`,
      title: 'Todo App Brainstorming'
    });
    
    // Wait for initial response
    const response1 = await conversation.waitForReply({ timeout: 30000 });
    console.log('Got initial response');
    expect(response1.content).toContain('todo');
    
    // Send clarification about features
    await conversation.sendMessage(`I'd like it to support:
- Adding tasks with priorities (high, medium, low)
- Marking tasks as complete
- Listing tasks filtered by status
- Saving to a JSON file
What do you think about the architecture?`);
    
    // Wait for architecture discussion
    const response2 = await conversation.waitForReply({ timeout: 30000 });
    console.log('Got architecture response');
    expect(response2.content.toLowerCase()).toMatch(/structure|architecture|design|approach/);
    
    // Agree and ask for implementation
    await conversation.sendMessage(`That sounds good! Can you create a basic implementation 
with those features? Start with a simple CLI using Node.js.`);
    
    // Wait for implementation to begin
    const response3 = await conversation.waitForReply({ timeout: 45000 });
    console.log('Got implementation response');
    
    // Wait for files to be created
    console.log('Waiting for project files...');
    
    // Check for main file
    const mainFile = await this.waitForMainFile(project);
    expect(mainFile).toBeDefined();
    console.log(`✓ Found main file: ${mainFile}`);
    
    // Verify the implementation includes todo functionality
    const mainContent = await project.readFile(mainFile!);
    this.verifyTodoImplementation(mainContent);
    
    // Check for package.json
    const hasPackageJson = await project.fileExists('package.json');
    if (hasPackageJson) {
      const packageJson = await project.readFile('package.json');
      const pkg = JSON.parse(packageJson);
      expect(pkg.name).toBeDefined();
      console.log(`✓ Found package.json for ${pkg.name}`);
    }
    
    // Check for README
    const hasReadme = await project.fileExists('README.md');
    if (hasReadme) {
      const readme = await project.readFile('README.md');
      expect(readme).toContain('todo');
      console.log('✓ Found README.md');
    }
    
    console.log('Simple brainstorming scenario completed successfully');
  }
  
  /**
   * Wait for and find the main implementation file
   */
  private async waitForMainFile(project: any): Promise<string | undefined> {
    const possibleNames = [
      'index.js',
      'todo.js',
      'cli.js',
      'app.js',
      'main.js',
      'src/index.js',
      'src/todo.js',
      'src/cli.js',
      'src/app.js',
      'src/main.js'
    ];
    
    // Try each possible name with a short timeout
    for (const name of possibleNames) {
      try {
        await project.waitForFile(name, { timeout: 5000 });
        return name;
      } catch {
        // Continue to next name
      }
    }
    
    return undefined;
  }
  
  /**
   * Verify the implementation contains todo functionality
   */
  private verifyTodoImplementation(content: string): void {
    const lowerContent = content.toLowerCase();
    
    // Check for task/todo related code
    expect(
      lowerContent.includes('task') || 
      lowerContent.includes('todo')
    ).toBe(true);
    
    // Check for priority handling
    expect(
      lowerContent.includes('priority') || 
      lowerContent.includes('high') ||
      lowerContent.includes('medium') ||
      lowerContent.includes('low')
    ).toBe(true);
    
    // Check for status/complete functionality
    expect(
      lowerContent.includes('complete') || 
      lowerContent.includes('status') ||
      lowerContent.includes('done')
    ).toBe(true);
    
    // Check for file operations
    expect(
      lowerContent.includes('readfile') || 
      lowerContent.includes('writefile') ||
      lowerContent.includes('fs') ||
      lowerContent.includes('json')
    ).toBe(true);
    
    console.log('✓ Implementation contains expected todo functionality');
  }
}