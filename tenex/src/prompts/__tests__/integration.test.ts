// Import from main index which loads all fragments
import { PromptBuilder, fragmentRegistry } from '..';
import { agentBaseFragment } from '../fragments/agentFragments';
import { projectFragment } from '../fragments/project';
import { toolsFragment } from '../fragments/tools';
import { routingFragment } from '../fragments/routing';

describe('Prompt System Integration', () => {
  beforeAll(() => {
    // Ensure fragments are registered
    fragmentRegistry.register(agentBaseFragment);
    fragmentRegistry.register(projectFragment);
    fragmentRegistry.register(toolsFragment);
    fragmentRegistry.register(routingFragment);
  });
  it('should build a complete agent prompt', () => {
    const agent = {
      name: 'Code Assistant',
      role: 'Senior Developer',
      instructions: 'You are an expert developer who helps users write clean, maintainable code.'
    };

    const project = {
      name: 'TENEX',
      description: 'A decentralized agent orchestration system',
      tags: ['nostr', 'ai', 'distributed']
    };

    const prompt = new PromptBuilder()
      .add('agent-base', { agent, project })
      .add('project-context', { project, detailed: true })
      .add('available-tools', { 
        tools: [
          { name: 'file', description: 'Read and write files' },
          { name: 'shell', description: 'Execute commands' }
        ]
      })
      .build();

    // Check that all parts are included
    expect(prompt).toContain('You are Code Assistant, a Senior Developer');
    expect(prompt).toContain('You are an expert developer');
    expect(prompt).toContain('## Project Context\n- Project: TENEX');
    expect(prompt).toContain('Project: TENEX');
    expect(prompt).toContain('Description: A decentralized agent orchestration system');
    expect(prompt).toContain('Tags: nostr, ai, distributed');
    expect(prompt).toContain('Available tools:');
    expect(prompt).toContain('- file - Read and write files');
    expect(prompt).toContain('- shell - Execute commands');

    // Check ordering (based on priorities)
    const lines = prompt.split('\n');
    const agentIndex = lines.findIndex(l => l.includes('You are Code Assistant'));
    const projectIndex = lines.findIndex(l => l.includes('Project: TENEX'));
    const toolsIndex = lines.findIndex(l => l.includes('Available tools:'));

    expect(agentIndex).toBeLessThan(projectIndex);
    expect(projectIndex).toBeLessThan(toolsIndex);
  });

  it('should build a routing prompt', () => {
    const availableAgents = ['Code Assistant', 'Data Analyst', 'Designer'];

    const prompt = new PromptBuilder()
      .add('routing-llm', { availableAgents })
      .build();

    expect(prompt).toContain('You are a routing LLM');
    expect(prompt).toContain('Available agents to route to:');
    availableAgents.forEach(agent => {
      expect(prompt).toContain(`- ${agent}`);
    });
  });

  it('should handle conditional fragments', () => {
    const agent = {
      name: 'Test Agent',
      instructions: 'Test instructions'
    };

    // Build with project
    const withProject = new PromptBuilder()
      .add('agent-base', { agent, project: { name: 'Project A' } })
      .build();

    expect(withProject).toContain('## Project Context\n- Project: Project A');

    // Build without project
    const withoutProject = new PromptBuilder()
      .add('agent-base', { agent })
      .build();

    expect(withoutProject).not.toContain('## Project Context');
  });

  it('should support custom inline fragments', () => {
    const customFragment = {
      id: 'custom-rules',
      priority: 25,
      template: ({ rules }: { rules: string[] }) => 
        `Custom Rules:\n${rules.map(r => `- ${r}`).join('\n')}`
    };

    const prompt = new PromptBuilder()
      .add('agent-base', { 
        agent: { name: 'Rule Follower', instructions: 'Follow the rules' }
      })
      .addFragment(customFragment, { 
        rules: ['Always be helpful', 'Never break character', 'Stay focused']
      })
      .add('available-tools', { tools: ['search'] })
      .build();

    // Check content
    expect(prompt).toContain('You are Rule Follower');
    expect(prompt).toContain('Custom Rules:');
    expect(prompt).toContain('- Always be helpful');
    expect(prompt).toContain('- Never break character');
    expect(prompt).toContain('- Stay focused');
    expect(prompt).toContain('Available tools:');

    // Check ordering - custom fragment should be between agent (10) and tools (30)
    const lines = prompt.split('\n');
    const agentIndex = lines.findIndex(l => l.includes('You are Rule Follower'));
    const rulesIndex = lines.findIndex(l => l.includes('Custom Rules:'));
    const toolsIndex = lines.findIndex(l => l.includes('Available tools:'));

    expect(agentIndex).toBeLessThan(rulesIndex);
    expect(rulesIndex).toBeLessThan(toolsIndex);
  });

  it('should handle empty prompts gracefully', () => {
    const prompt = new PromptBuilder().build();
    expect(prompt).toBe('');
  });

  it('should filter empty tool lists', () => {
    const prompt = new PromptBuilder()
      .add('agent-base', { 
        agent: { name: 'Test', instructions: 'Test' }
      })
      .add('available-tools', { tools: [] })
      .build();

    expect(prompt).toContain('You are Test');
    expect(prompt).not.toContain('Available tools:');
  });

  it('should handle complex conditional logic', () => {
    interface ConditionalArgs {
      mode: 'development' | 'production';
      debugLevel?: number;
    }

    const debugFragment = {
      id: 'debug-info',
      priority: 40,
      template: ({ mode, debugLevel = 0 }: ConditionalArgs) => 
        `Debug Mode: ${mode}, Level: ${debugLevel}`
    };

    const builder = new PromptBuilder();

    // Add debug info only in development mode
    builder.add('agent-base', { 
      agent: { name: 'Debugger', instructions: 'Debug the system' }
    });

    builder.addFragment(
      debugFragment, 
      { mode: 'development', debugLevel: 3 },
      (args) => args.mode === 'development'
    );

    const devPrompt = builder.build();
    expect(devPrompt).toContain('Debug Mode: development, Level: 3');

    // Production mode - debug fragment should be filtered out
    const prodBuilder = new PromptBuilder()
      .add('agent-base', { 
        agent: { name: 'Debugger', instructions: 'Debug the system' }
      })
      .addFragment(
        debugFragment,
        { mode: 'production', debugLevel: 0 },
        (args) => args.mode === 'development'
      );

    const prodPrompt = prodBuilder.build();
    expect(prodPrompt).not.toContain('Debug Mode:');
  });
});