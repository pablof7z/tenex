#!/usr/bin/env bun

import { Command } from 'commander';
import { 
  ScenarioRegistry,
  BaseScenario,
  ScenarioResult
} from './index';

const program = new Command();

// Use ScenarioRegistry for dynamic scenario management
const createScenario = (name: string, options?: any): BaseScenario => {
  return ScenarioRegistry.createScenario(name, options);
};

const getScenarioNames = () => ScenarioRegistry.getScenarioNames();

program
  .name('tenex-e2e')
  .description('TENEX E2E Testing Framework CLI')
  .version('1.0.0');

program
  .command('run [scenario]')
  .description('Run E2E test scenarios')
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic)', 'openai')
  .option('-m, --model <model>', 'LLM model name', 'gpt-4')
  .option('-k, --api-key <key>', 'API key for LLM provider')
  .option('-r, --relays <relays>', 'Comma-separated list of relay URLs')
  .option('-d, --debug', 'Enable debug logging')
  .option('-l, --log-file <file>', 'Log output to file')
  .action(async (scenarioName, options) => {
    try {
      const apiKey = options.apiKey || process.env['OPENAI_API_KEY'] || process.env['ANTHROPIC_API_KEY'];
      
      if (!apiKey) {
        console.error('Error: No API key provided. Use --api-key or set OPENAI_API_KEY/ANTHROPIC_API_KEY environment variable');
        process.exit(1);
      }
      
      const llmConfig = {
        provider: options.provider,
        model: options.model,
        apiKey
      };
      
      const scenarioOptions = {
        llmConfig,
        relays: options.relays?.split(','),
        debug: options.debug,
        logFile: options.logFile
      };
      
      if (scenarioName) {
        // Run specific scenario
        const validScenarios = getScenarioNames();
        if (!validScenarios.includes(scenarioName)) {
          console.error(`Unknown scenario: ${scenarioName}`);
          console.log(`Available scenarios: ${validScenarios.join(', ')}`);
          process.exit(1);
        }
        
        console.log(`Running ${scenarioName} scenario...`);
        const scenario = createScenario(scenarioName, scenarioOptions);
        const result = await scenario.execute();
        printResult(result);
        
        process.exit(result.success ? 0 : 1);
      } else {
        // Run all scenarios
        console.log('Running all scenarios...\n');
        const results: ScenarioResult[] = [];
        
        for (const name of getScenarioNames()) {
          console.log(`Running ${name}...`);
          try {
            const scenario = createScenario(name, scenarioOptions);
            const result = await scenario.execute();
            results.push(result);
            printResult(result);
            console.log('');
          } catch (error) {
            console.error(`Failed to run ${name}: ${(error as Error).message}`);
          }
        }
        
        // Summary
        console.log('\n=== Summary ===');
        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`Total: ${results.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        
        process.exit(failed > 0 ? 1 : 0);
      }
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available test scenarios')
  .action(() => {
    console.log('Available test scenarios:\n');
    const scenarios = ScenarioRegistry.getScenarioInfo();
    
    for (const { name, description } of scenarios) {
      console.log(`  ${name.padEnd(20)} - ${description}`);
    }
  });

function printResult(result: ScenarioResult) {
  const status = result.success ? '✅ PASSED' : '❌ FAILED';
  console.log(`${status} - ${result.name} (${(result.duration / 1000).toFixed(2)}s)`);
  if (result.error) {
    console.error(`  Error: ${result.error.message}`);
  }
}

program.parse();