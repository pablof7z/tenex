import { BaseScenario } from '../BaseScenario';
import { FileCreationScenario } from './FileCreationScenario';
import { MultiAgentScenario } from './MultiAgentScenario';
import { BuildModeScenario } from './BuildModeScenario';
import { ErrorHandlingScenario } from './ErrorHandlingScenario';
import { BrainstormingScenario } from './BrainstormingScenario';
import { PhaseTransitionScenario } from './PhaseTransitionScenario';
import { SimpleBrainstormingScenario } from './SimpleBrainstormingScenario';

export interface ScenarioInfo {
  name: string;
  description: string;
  className: string;
}

export class ScenarioRegistry {
  private static scenarios: Map<string, typeof BaseScenario> = new Map([
    ['file-creation', FileCreationScenario],
    ['multi-agent', MultiAgentScenario],
    ['build-mode', BuildModeScenario],
    ['error-handling', ErrorHandlingScenario],
    ['brainstorming', BrainstormingScenario],
    ['phase-transition', PhaseTransitionScenario],
    ['simple-brainstorming', SimpleBrainstormingScenario]
  ]);
  
  static getScenario(name: string): typeof BaseScenario | undefined {
    return this.scenarios.get(name);
  }
  
  static getScenarioNames(): string[] {
    return Array.from(this.scenarios.keys());
  }
  
  static getScenarioInfo(): ScenarioInfo[] {
    const info: ScenarioInfo[] = [];
    
    for (const [name, ScenarioClass] of this.scenarios.entries()) {
      // Create temporary instance to get name and description
      const instance = new (ScenarioClass as any)();
      info.push({
        name,
        description: instance.description,
        className: instance.name
      });
    }
    
    return info;
  }
  
  static createScenario(name: string, options?: any): BaseScenario {
    const ScenarioClass = this.scenarios.get(name);
    if (!ScenarioClass) {
      throw new Error(`Unknown scenario: ${name}`);
    }
    return new (ScenarioClass as any)(options);
  }
  
  static registerScenario(name: string, scenarioClass: typeof BaseScenario): void {
    this.scenarios.set(name, scenarioClass);
  }
}