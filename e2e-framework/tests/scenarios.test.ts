import { describe, test, expect } from 'bun:test';
import { 
  FileCreationScenario,
  MultiAgentScenario,
  BuildModeScenario,
  ErrorHandlingScenario
} from '../src';

// These tests require a running TENEX daemon and proper LLM configuration
// Run with: bun test scenarios.test.ts

describe('E2E Test Scenarios', () => {
  test('File Creation Scenario', async () => {
    const scenario = new FileCreationScenario({
      llmConfig: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || ''
      }
    });
    
    const result = await scenario.execute();
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  }, 120000); // 2 minute timeout
  
  test('Multi-Agent Scenario', async () => {
    const scenario = new MultiAgentScenario({
      llmConfig: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || ''
      }
    });
    
    const result = await scenario.execute();
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  }, 180000); // 3 minute timeout
  
  test('Build Mode Scenario', async () => {
    const scenario = new BuildModeScenario({
      llmConfig: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || ''
      }
    });
    
    const result = await scenario.execute();
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  }, 300000); // 5 minute timeout
  
  test('Error Handling Scenario', async () => {
    const scenario = new ErrorHandlingScenario({
      llmConfig: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: process.env.OPENAI_API_KEY || ''
      }
    });
    
    const result = await scenario.execute();
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  }, 120000); // 2 minute timeout
});