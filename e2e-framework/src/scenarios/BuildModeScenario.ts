import { BaseScenario } from '../BaseScenario';
import { expect } from 'bun:test';
import { NostrEventKinds } from '../constants';

export class BuildModeScenario extends BaseScenario {
  name = 'Build Mode Test';
  description = 'Tests complex build mode activation and multi-file creation';
  
  async run(): Promise<void> {
    // Create project with architect and coder agents
    const project = await this.orchestrator.createProject({
      name: 'todo-app-test',
      description: 'Test project for build mode',
      agents: ['architect', 'coder'],
      instructions: ['be-concise', 'use-react']
    });
    
    // Send complex request that should trigger build mode
    const conversation = await project.startConversation({
      message: '@architect design and @coder implement a complete todo app with React including components for TodoList, TodoItem, and AddTodo',
      title: 'Build Mode Test'
    });
    
    // Monitor for building indicators
    const projectEvents = await this.orchestrator.monitor.subscribeToProject(project.naddr);
    
    let buildingDetected = false;
    const checkBuildMode = async () => {
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 30000));
      const eventCheckPromise = (async () => {
        for await (const event of projectEvents) {
          // Check for build mode status events
          if (event.kind === NostrEventKinds.BUILD_STATUS) {
            const statusTag = event.tags.find(t => t[0] === 'status');
            if (statusTag && statusTag[1] === 'building') {
              buildingDetected = true;
              return;
            }
          }
          
          // Also check for building indicators in messages
          if (event.kind === NostrEventKinds.NOTE && event.content.toLowerCase().includes('building')) {
            buildingDetected = true;
            return;
          }
        }
      })();
      
      await Promise.race([eventCheckPromise, timeoutPromise]);
    };
    
    // Start monitoring in background
    checkBuildMode();
    
    // Wait for essential files to be created
    const filePromises = [
      project.waitForFile('package.json', { timeout: 60000 }),
      project.waitForFile('src/App.jsx', { timeout: 60000 }),
      project.waitForFile('src/components/TodoList.jsx', { timeout: 60000 })
    ];
    
    // Wait for at least package.json to ensure project setup
    await filePromises[0];
    
    // Check package.json contains React
    const packageJson = await project.readFile('package.json');
    const pkg = JSON.parse(packageJson);
    expect(pkg.dependencies?.react || pkg.devDependencies?.react).toBeDefined();
    
    // Wait for remaining files
    await Promise.all(filePromises);
    
    // Verify component files exist
    const todoListContent = await project.readFile('src/components/TodoList.jsx');
    expect(todoListContent).toContain('TodoList');
    expect(todoListContent).toMatch(/export|function|const/);
    
    // Check for other expected files
    const hasAddTodo = await project.fileExists('src/components/AddTodo.jsx');
    const hasTodoItem = await project.fileExists('src/components/TodoItem.jsx');
    
    expect(hasAddTodo || hasTodoItem).toBe(true);
    
    // Wait for completion
    await conversation.waitForCompletion({
      timeout: 90000,
      indicators: ['completed', 'finished', 'done', 'created', 'implemented']
    });
    
    // Log whether build mode was detected
    console.log(`Build mode detected: ${buildingDetected}`);
  }
}