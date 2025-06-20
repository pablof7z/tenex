import { FragmentRegistry } from '../core/FragmentRegistry';
import { agentFragment } from '../fragments/agent';
import { projectFragment } from '../fragments/project';
import { toolsFragment } from '../fragments/tools';
import { routingFragment } from '../fragments/routing';

describe('Fragment Examples', () => {
  describe('agentFragment', () => {
    it('should generate basic agent prompt', () => {
      const result = agentFragment.template({
        agent: {
          name: 'Code Assistant',
          instructions: 'You help users write better code.'
        }
      });

      expect(result).toBe('You are Code Assistant\n\nYou help users write better code.');
    });

    it('should include role when provided', () => {
      const result = agentFragment.template({
        agent: {
          name: 'Code Assistant',
          role: 'Senior Developer',
          instructions: 'You help users write better code.'
        }
      });

      expect(result).toBe('You are Code Assistant, Senior Developer\n\nYou help users write better code.');
    });

    it('should include project when provided', () => {
      const result = agentFragment.template({
        agent: {
          name: 'Code Assistant',
          instructions: 'You help users write better code.'
        },
        project: {
          name: 'My Project'
        }
      });

      expect(result).toContain('Working on project: My Project');
    });

    it('should have correct priority', () => {
      expect(agentFragment.priority).toBe(10);
    });
  });

  describe('projectFragment', () => {
    it('should generate basic project prompt', () => {
      const result = projectFragment.template({
        project: {
          name: 'TENEX'
        }
      });

      expect(result).toBe('---\nProject: TENEX');
    });

    it('should include details when detailed is true', () => {
      const result = projectFragment.template({
        project: {
          name: 'TENEX',
          description: 'A decentralized system',
          tags: ['nostr', 'ai', 'agents'],
          metadata: { version: '1.0', author: 'Alice' }
        },
        detailed: true
      });

      expect(result).toContain('Project: TENEX');
      expect(result).toContain('Description: A decentralized system');
      expect(result).toContain('Tags: nostr, ai, agents');
      expect(result).toContain('Metadata:');
      expect(result).toContain('"version": "1.0"');
      expect(result).toContain('"author": "Alice"');
    });

    it('should omit details when detailed is false', () => {
      const result = projectFragment.template({
        project: {
          name: 'TENEX',
          description: 'A decentralized system',
          tags: ['nostr', 'ai']
        },
        detailed: false
      });

      expect(result).toBe('---\nProject: TENEX');
      expect(result).not.toContain('Description');
      expect(result).not.toContain('Tags');
    });

    it('should have correct priority', () => {
      expect(projectFragment.priority).toBe(20);
    });
  });

  describe('toolsFragment', () => {
    it('should handle string array of tools', () => {
      const result = toolsFragment.template({
        tools: ['file', 'shell', 'search']
      });

      expect(result).toBe('Available tools:\n- file\n- shell\n- search');
    });

    it('should handle object array with descriptions', () => {
      const result = toolsFragment.template({
        tools: [
          { name: 'file', description: 'Read and write files' },
          { name: 'shell', description: 'Execute shell commands' },
          { name: 'search' }
        ]
      });

      expect(result).toContain('- file - Read and write files');
      expect(result).toContain('- shell - Execute shell commands');
      expect(result).toContain('- search');
    });

    it('should return empty string for empty tools array', () => {
      const result = toolsFragment.template({ tools: [] });
      expect(result).toBe('');
    });

    it('should have correct priority', () => {
      expect(toolsFragment.priority).toBe(30);
    });
  });

  describe('routingFragment', () => {
    it('should generate basic routing prompt', () => {
      const result = routingFragment.template({});

      expect(result).toBe('You are a routing LLM. Your job is to analyze requests and route them to the appropriate agent.');
    });

    it('should include available agents when provided', () => {
      const result = routingFragment.template({
        availableAgents: ['Code Assistant', 'Data Analyst', 'Project Manager']
      });

      expect(result).toContain('You are a routing LLM');
      expect(result).toContain('Available agents to route to:');
      expect(result).toContain('- Code Assistant');
      expect(result).toContain('- Data Analyst');
      expect(result).toContain('- Project Manager');
    });

    it('should handle empty agents array', () => {
      const result = routingFragment.template({
        availableAgents: []
      });

      expect(result).toBe('You are a routing LLM. Your job is to analyze requests and route them to the appropriate agent.');
    });

    it('should have correct priority', () => {
      expect(routingFragment.priority).toBe(5);
    });
  });

  describe('auto-registration', () => {
    it('should auto-register all fragments', () => {
      // The fragments are already registered when the modules are imported
      // Just verify they exist in the global registry
      const { fragmentRegistry } = require('../core/FragmentRegistry');

      expect(fragmentRegistry.has('agent-base')).toBe(true);
      expect(fragmentRegistry.has('project-context')).toBe(true);
      expect(fragmentRegistry.has('available-tools')).toBe(true);
      expect(fragmentRegistry.has('routing-llm')).toBe(true);
    });
  });
});