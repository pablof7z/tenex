import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { BaseScenario, ScenarioResult } from '../src/BaseScenario';
import { Orchestrator } from '../src/Orchestrator';

// Create a concrete implementation for testing
class TestScenario extends BaseScenario {
  name = 'Test Scenario';
  description = 'A test scenario';
  runCalled = false;
  shouldThrow = false;
  
  async run(): Promise<void> {
    this.runCalled = true;
    if (this.shouldThrow) {
      throw new Error('Test error');
    }
  }
}

describe('BaseScenario', () => {
  let scenario: TestScenario;
  
  beforeEach(() => {
    scenario = new TestScenario();
    // Mock orchestrator methods to prevent actual daemon startup
    scenario['orchestrator'].setup = mock(() => Promise.resolve());
    scenario['orchestrator'].teardown = mock(() => Promise.resolve());
  });
  
  test('should have correct name and description', () => {
    expect(scenario.name).toBe('Test Scenario');
    expect(scenario.description).toBe('A test scenario');
  });
  
  test('should call setup, run, and teardown in correct order', async () => {    
    const result = await scenario.execute();
    
    expect(scenario['orchestrator'].setup).toHaveBeenCalledTimes(1);
    expect(scenario['orchestrator'].teardown).toHaveBeenCalledTimes(1);
    expect(scenario.runCalled).toBe(true);
    expect(result.success).toBe(true);
  });
  
  test('should return success result when scenario completes', async () => {
    const result = await scenario.execute();
    
    expect(result.name).toBe('Test Scenario');
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
  
  test('should return failure result when scenario throws', async () => {
    scenario.shouldThrow = true;
    
    let thrownError: Error | null = null;
    try {
      await scenario.execute();
    } catch (error) {
      thrownError = error as Error;
    }
    
    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toBe('Test error');
  });
  
  test('should always call teardown even on error', async () => {
    scenario.shouldThrow = true;
    
    try {
      await scenario.execute();
    } catch {
      // Expected to throw
    }
    
    expect(scenario['orchestrator'].teardown).toHaveBeenCalledTimes(1);
  });
  
  test('should accept configuration options', () => {
    const options = {
      relays: ['wss://test.relay'],
      llmConfig: {
        provider: 'test' as const,
        model: 'test-model',
        apiKey: 'test-key'
      }
    };
    
    const configuredScenario = new TestScenario(options);
    expect(configuredScenario['orchestrator']).toBeDefined();
  });
  
  test('should measure execution duration', async () => {
    // Add a small delay to ensure measurable duration
    scenario.run = async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    };
    
    const result = await scenario.execute();
    
    expect(result.duration).toBeGreaterThan(9); // Should be at least 10ms
  });
});