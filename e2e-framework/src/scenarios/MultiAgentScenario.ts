import { BaseScenario } from '../BaseScenario';
import { expect } from 'bun:test';

export class MultiAgentScenario extends BaseScenario {
  name = 'Multi-Agent Collaboration Test';
  description = 'Tests collaboration between architect and coder agents';
  
  async run(): Promise<void> {
    // Create project with multiple agents
    const project = await this.orchestrator.createProject({
      name: 'multi-agent-test',
      description: 'Test project for agent collaboration',
      agents: ['architect', 'coder'],
      instructions: ['be-concise', 'collaborate-effectively']
    });
    
    // Start conversation requesting architecture and implementation
    const conversation = await project.startConversation({
      message: '@architect design a simple calculator module and @coder implement it with add and subtract functions',
      title: 'Multi-Agent Collaboration Test'
    });
    
    // Wait for the architect's response first
    const architectReply = await conversation.waitForReply({
      timeout: 30000,
      validate: (event) => {
        // Look for architect's response about design
        return event.content.toLowerCase().includes('design') || 
               event.content.toLowerCase().includes('architecture') ||
               event.content.toLowerCase().includes('module');
      }
    });
    
    expect(architectReply).toBeDefined();
    
    // Wait for calculator implementation
    await project.waitForFile('calculator.js', {
      timeout: 45000
    });
    
    // Verify the calculator has both functions
    const calculatorContent = await project.readFile('calculator.js');
    expect(calculatorContent).toContain('add');
    expect(calculatorContent).toContain('subtract');
    
    // Check if TypeScript file was created instead
    const hasJsFile = await project.fileExists('calculator.js');
    const hasTsFile = await project.fileExists('calculator.ts');
    expect(hasJsFile || hasTsFile).toBe(true);
    
    // Wait for completion from coder
    await conversation.waitForCompletion({
      timeout: 60000,
      indicators: ['implemented', 'created', 'done', 'complete', 'finished']
    });
  }
}