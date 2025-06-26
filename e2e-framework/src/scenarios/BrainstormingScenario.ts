import { BaseScenario } from '../BaseScenario';
import { LLMConversationSimulator } from '../utils/LLMConversationSimulator';
import { expect } from 'bun:test';

/**
 * Tests a realistic brainstorming session where an LLM simulates a human user
 * discussing project ideas with TENEX, leading to project creation and implementation.
 * 
 * This scenario tests:
 * 1. Multi-turn conversation handling
 * 2. Natural language understanding
 * 3. Phase transitions (chat -> planning -> building)
 * 4. Project creation based on conversation
 * 5. Agent coordination
 */
export class BrainstormingScenario extends BaseScenario {
  name = 'Brainstorming Session';
  description = 'Tests realistic brainstorming leading to project creation';
  
  async run(): Promise<void> {
    console.log('Creating project for brainstorming...');
    
    // Create project with architect and coder agents
    const project = await this.orchestrator.createProject({
      name: 'brainstorm-project',
      description: 'A project created through brainstorming',
      agents: ['architect', 'coder'],
      instructions: ['be-helpful', 'be-creative']
    });
    
    // Configure LLM simulator
    const simulator = new LLMConversationSimulator({
      llmProvider: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || ''
      },
      userPersona: 'a startup founder with a vague idea for a productivity app',
      conversationGoal: 'brainstorm and refine the idea into a concrete project plan',
      maxTurns: 15,
      turnDelay: 1500,
      debug: true
    });
    
    console.log('Starting brainstorming conversation...');
    
    // Start conversation with initial brainstorming message
    const conversation = await project.startConversation({
      message: `I have an idea for a productivity app but I'm not sure about the details. 
I'm thinking something that helps people track their daily habits and goals, 
but I want it to be different from existing apps. Can you help me brainstorm 
and figure out what would make this unique and valuable?`,
      title: 'Productivity App Brainstorming'
    });
    
    // Simulate the conversation
    const exchanges = await simulator.simulateConversation(
      conversation,
      '' // Initial message already sent
    );
    
    console.log(`Conversation completed with ${exchanges.length} exchanges`);
    
    // Verify conversation progressed through phases
    this.verifyConversationProgression(exchanges);
    
    // Wait for project files to be created
    console.log('Waiting for project structure...');
    
    // Check for common project files that should be created
    const expectedFiles = [
      'README.md',
      'package.json',
      '.gitignore'
    ];
    
    for (const file of expectedFiles) {
      try {
        await project.waitForFile(file, { timeout: 60000 });
        console.log(`✓ Found ${file}`);
      } catch (error) {
        console.log(`✗ Missing ${file}`);
      }
    }
    
    // Verify project has meaningful content
    const readme = await project.readFile('README.md');
    expect(readme.length).toBeGreaterThan(100);
    expect(readme).toContain('habit');
    
    // Check if package.json was customized based on conversation
    const packageJson = await project.readFile('package.json');
    const pkg = JSON.parse(packageJson);
    expect(pkg.name).toBeDefined();
    expect(pkg.description).toBeDefined();
    
    console.log('Brainstorming scenario completed successfully');
  }
  
  /**
   * Verify the conversation progressed naturally through brainstorming
   */
  private verifyConversationProgression(
    exchanges: Array<{ role: 'user' | 'assistant', message: string }>
  ): void {
    // Check minimum conversation length
    expect(exchanges.length).toBeGreaterThanOrEqual(4);
    
    // Verify initial exchanges are exploratory
    const earlyExchanges = exchanges.slice(0, 3);
    const hasQuestions = earlyExchanges.some(ex => 
      ex.role === 'assistant' && ex.message.includes('?')
    );
    expect(hasQuestions).toBe(true);
    
    // Verify later exchanges show progress
    const laterExchanges = exchanges.slice(-3);
    const hasActionableContent = laterExchanges.some(ex =>
      ex.message.toLowerCase().includes('create') ||
      ex.message.toLowerCase().includes('implement') ||
      ex.message.toLowerCase().includes('build') ||
      ex.message.toLowerCase().includes('plan')
    );
    expect(hasActionableContent).toBe(true);
    
    // Log conversation summary for debugging
    console.log('\nConversation Summary:');
    exchanges.forEach((ex, i) => {
      const preview = ex.message.substring(0, 80).replace(/\n/g, ' ');
      console.log(`${i + 1}. ${ex.role}: ${preview}...`);
    });
  }
}