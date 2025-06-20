import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';

export function createTestPhasesCommand(): Command {
  return new Command('phases')
    .description('Test phase initializers')
    .action(async () => {
      try {
        console.log('🧪 Testing Phase Initializers...\n');
        
        // Run the phase initializers test script
        const testScript = path.join(process.cwd(), 'test-phase-initializers.ts');
        execSync(`bun ${testScript}`, { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Phase initializers test failed:', error);
        process.exit(1);
      }
    });
}