import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';

export function createTestAgentExecutionCommand(): Command {
  return new Command('agent-execution')
    .description('Test agent execution system')
    .action(async () => {
      try {
        console.log('🤖 Testing Agent Execution System...\n');
        
        // Run the agent execution test script
        const testScript = path.join(process.cwd(), 'test-agent-execution.ts');
        execSync(`bun ${testScript}`, { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Agent execution test failed:', error);
        process.exit(1);
      }
    });
}