import { BaseScenario } from '../BaseScenario';
import { LLMConversationSimulator } from '../utils/LLMConversationSimulator';
import { expect } from 'bun:test';

/**
 * Tests TENEX's ability to handle phase transitions during a brainstorming session.
 * 
 * This scenario specifically tests:
 * 1. Starting in chat phase for requirements gathering
 * 2. Transitioning to planning phase when requirements are clear
 * 3. Moving to building phase to implement the plan
 * 4. Proper agent handoffs between phases
 */
export class PhaseTransitionScenario extends BaseScenario {
  name = 'Phase Transition Test';
  description = 'Tests chat -> planning -> building phase transitions';
  
  async run(): Promise<void> {
    console.log('Creating project with phase-aware agents...');
    
    // Create project with agents that handle different phases
    const project = await this.orchestrator.createProject({
      name: 'phase-test',
      description: 'Testing phase transitions',
      agents: ['project-manager', 'architect', 'coder'],
      instructions: ['follow-phases', 'be-systematic']
    });
    
    // Configure LLM simulator for focused conversation
    const simulator = new LLMConversationSimulator({
      llmProvider: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || ''
      },
      userPersona: 'a developer who knows exactly what they want to build',
      conversationGoal: 'quickly move from idea to implementation of a simple CLI tool',
      maxTurns: 20,
      turnDelay: 1000,
      debug: true
    });
    
    console.log('Starting phase-aware conversation...');
    
    // Start with a clear, actionable request
    const conversation = await project.startConversation({
      message: `I need to build a simple CLI tool that converts JSON to YAML. 
I want it to:
1. Accept input from stdin or a file
2. Output to stdout or a file  
3. Have proper error handling
4. Include help documentation

Can you help me plan and build this?`,
      title: 'JSON to YAML Converter'
    });
    
    // Track phase transitions
    const phaseTransitions: string[] = [];
    let currentPhase = 'chat';
    
    // Monitor conversation for phase transitions
    conversation.on('event', (event) => {
      if (event.type === 'phase_transition') {
        phaseTransitions.push(`${currentPhase} -> ${event.data.phase}`);
        currentPhase = event.data.phase;
        console.log(`Phase transition: ${currentPhase}`);
      }
    });
    
    // Simulate the conversation
    const exchanges = await simulator.simulateConversation(
      conversation,
      '' // Initial message already sent
    );
    
    console.log(`Conversation completed with ${exchanges.length} exchanges`);
    console.log(`Phase transitions: ${phaseTransitions.join(', ')}`);
    
    // Verify phase transitions occurred
    expect(phaseTransitions.length).toBeGreaterThanOrEqual(1);
    expect(phaseTransitions.some(t => t.includes('planning'))).toBe(true);
    
    // Wait for implementation files
    console.log('Waiting for implementation...');
    
    // Check for the main CLI file
    const cliFile = await this.findMainFile(project);
    expect(cliFile).toBeDefined();
    console.log(`✓ Found main file: ${cliFile}`);
    
    // Verify the implementation
    const mainContent = await project.readFile(cliFile!);
    this.verifyImplementation(mainContent);
    
    // Check for package.json with proper dependencies
    const packageJson = await project.readFile('package.json');
    const pkg = JSON.parse(packageJson);
    expect(pkg.dependencies || pkg.devDependencies).toBeDefined();
    
    // Check for help documentation
    const hasReadme = await project.fileExists('README.md');
    expect(hasReadme).toBe(true);
    
    console.log('Phase transition scenario completed successfully');
  }
  
  /**
   * Find the main CLI file (could be index.js, cli.js, etc.)
   */
  private async findMainFile(project: any): Promise<string | undefined> {
    const possibleNames = [
      'index.js',
      'index.ts', 
      'cli.js',
      'cli.ts',
      'json2yaml.js',
      'json2yaml.ts',
      'converter.js',
      'converter.ts',
      'src/index.js',
      'src/index.ts',
      'src/cli.js',
      'src/cli.ts'
    ];
    
    for (const name of possibleNames) {
      if (await project.fileExists(name)) {
        return name;
      }
    }
    
    return undefined;
  }
  
  /**
   * Verify the implementation meets requirements
   */
  private verifyImplementation(content: string): void {
    // Check for JSON/YAML handling
    expect(
      content.includes('JSON') || 
      content.includes('json') ||
      content.includes('parse')
    ).toBe(true);
    
    expect(
      content.includes('YAML') || 
      content.includes('yaml') ||
      content.includes('yml')
    ).toBe(true);
    
    // Check for file handling
    expect(
      content.includes('readFile') || 
      content.includes('createReadStream') ||
      content.includes('stdin')
    ).toBe(true);
    
    // Check for error handling
    expect(
      content.includes('try') || 
      content.includes('catch') ||
      content.includes('error')
    ).toBe(true);
    
    // Check for CLI structure
    expect(
      content.includes('process.argv') || 
      content.includes('commander') ||
      content.includes('yargs') ||
      content.includes('cli')
    ).toBe(true);
  }
}