import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';

export function createTestIntegrationCommand(): Command {
  return new Command('integration')
    .description('Run full integration test of the agentic routing system')
    .action(async () => {
      try {
        console.log('🚀 Running Integration Test...\n');
        
        // Run the integration test script
        const testScript = path.join(process.cwd(), 'test-integration.ts');
        execSync(`bun ${testScript}`, { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Integration test failed:', error);
        process.exit(1);
      }
    });
}