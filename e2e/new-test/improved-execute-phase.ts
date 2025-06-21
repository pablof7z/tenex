// Suggested improvements for ExecutePhaseInitializer.ts

/**
 * Build detailed implementation context from conversation history
 */
private buildImplementationContext(conversation: ConversationState): string {
  // Get all messages from the conversation history
  const messages = conversation.history
    .map((event) => {
      // Skip system messages and phase transitions
      if (event.tags.some((tag) => tag[0] === "phase-transition")) {
        return null;
      }
      
      // Extract author info
      const isUser = !event.tags.some((tag) => tag[0] === "llm-model");
      const author = isUser ? "User" : "Assistant";
      
      return `${author}: ${event.content}`;
    })
    .filter(Boolean);

  // Join relevant messages
  const conversationContext = messages.slice(-10).join("\n\n"); // Last 10 messages for context
  
  return conversationContext;
}

/**
 * Extract specific implementation requirements from conversation
 */
private extractImplementationRequirements(conversation: ConversationState): string {
  // Get user messages to understand requirements
  const userMessages = conversation.history
    .filter(event => !event.tags.some(tag => tag[0] === "llm-model"))
    .map(event => event.content);
  
  if (userMessages.length === 0) {
    return "Implement the features according to the plan.";
  }
  
  // Look for specific patterns in user messages
  const requirements = [];
  
  // Check for technology mentions
  const techKeywords = ['typescript', 'javascript', 'react', 'node', 'express', 'api', 'database'];
  const mentionedTech = techKeywords.filter(tech => 
    userMessages.some(msg => msg.toLowerCase().includes(tech))
  );
  
  if (mentionedTech.length > 0) {
    requirements.push(`Technologies to use: ${mentionedTech.join(', ')}`);
  }
  
  // Check for specific feature requests
  const featureKeywords = ['function', 'endpoint', 'component', 'service', 'module'];
  const requestedFeatures = userMessages
    .filter(msg => featureKeywords.some(keyword => msg.toLowerCase().includes(keyword)))
    .slice(-3); // Last 3 relevant messages
  
  if (requestedFeatures.length > 0) {
    requirements.push(`Specific features requested:\n${requestedFeatures.map(f => `- ${f}`).join('\n')}`);
  }
  
  // Add quality requirements
  requirements.push(`Quality requirements:
- Write clean, maintainable code
- Include appropriate error handling
- Add comments for complex logic
- Follow TypeScript/JavaScript best practices
- Include unit tests where appropriate`);
  
  return requirements.join('\n\n');
}

/**
 * Build a comprehensive prompt for Claude Code execution
 */
private buildExecutionPrompt(
  conversation: ConversationState,
  plan: string
): string {
  const context = this.buildImplementationContext(conversation);
  const requirements = this.extractImplementationRequirements(conversation);
  
  // Determine if this is a simple task or complex implementation
  const isSimpleTask = this.isSimpleImplementationTask(conversation);
  
  if (isSimpleTask) {
    // For simple tasks, be very direct
    const task = this.extractSimpleTask(conversation);
    return `Task: ${task}

${requirements}

Instructions:
1. Implement the requested functionality
2. Create necessary files and folders
3. Include appropriate type definitions
4. Add basic tests if applicable
5. Ensure the code runs without errors

Focus on delivering working code that directly addresses the request.`;
  }
  
  // For complex implementations from plans
  return `Implementation Phase

Previous Context:
${context}

Approved Plan:
${plan}

${requirements}

Instructions:
1. Implement according to the approved plan
2. Create all necessary files and project structure
3. Implement core functionality first
4. Add error handling and edge cases
5. Include tests for critical paths
6. Ensure all code is properly typed (if using TypeScript)
7. Test that everything works as expected

Begin implementation now. Focus on delivering working, production-ready code.`;
}

/**
 * Determine if this is a simple, self-contained implementation task
 */
private isSimpleImplementationTask(conversation: ConversationState): boolean {
  const lastUserMessage = conversation.history
    .filter(event => !event.tags.some(tag => tag[0] === "llm-model"))
    .slice(-1)[0]?.content || "";
  
  // Simple task indicators
  const simpleIndicators = [
    'function',
    'small',
    'simple',
    'quick',
    'basic',
    'single',
    'fibonacci',
    'helper',
    'utility'
  ];
  
  const complexIndicators = [
    'application',
    'system',
    'platform',
    'full',
    'complete',
    'entire',
    'project'
  ];
  
  const messageLower = lastUserMessage.toLowerCase();
  const hasSimpleIndicator = simpleIndicators.some(ind => messageLower.includes(ind));
  const hasComplexIndicator = complexIndicators.some(ind => messageLower.includes(ind));
  
  // It's simple if it has simple indicators and no complex ones
  return hasSimpleIndicator && !hasComplexIndicator;
}

/**
 * Extract the simple task description
 */
private extractSimpleTask(conversation: ConversationState): string {
  const lastUserMessage = conversation.history
    .filter(event => !event.tags.some(tag => tag[0] === "llm-model"))
    .slice(-1)[0]?.content || "Implement the requested feature";
  
  return lastUserMessage;
}

// Updated triggerClaudeCode method
private async triggerClaudeCode(
  conversation: ConversationState,
  plan: string,
  instruction: string
): Promise<boolean> {
  try {
    const projectContext = getProjectContext();

    // Get NDK and signer from project context
    const ndk = projectContext.ndk;
    const signer = projectContext.projectSigner;

    // Get the root event from the conversation
    const rootEvent = conversation.history[0];
    if (!rootEvent) {
      this.logError("No root event found in conversation");
      return false;
    }

    // Build a comprehensive prompt instead of generic instruction
    const prompt = this.buildExecutionPrompt(conversation, plan);

    this.log("Triggering Claude Code CLI for execution with monitoring", {
      conversationId: conversation.id,
      promptLength: prompt.length,
      isSimpleTask: this.isSimpleImplementationTask(conversation),
    });

    // Create and execute Claude Code with monitoring
    const executor = new ClaudeCodeExecutor({
      prompt,
      projectPath: projectContext.projectDir,
      ndk,
      projectContext,
      conversationRootEvent: rootEvent,
      signer,
      title: "Execute Implementation",
      phase: "execute",
    });

    const result = await executor.execute();

    if (result.success) {
      this.log("Claude Code execution completed successfully", {
        sessionId: result.sessionId,
        taskId: result.taskEvent?.id,
        totalCost: result.totalCost,
        messageCount: result.messageCount,
      });

      // Store task ID in conversation metadata for tracking
      if (result.taskEvent) {
        conversation.metadata.executeTaskId = result.taskEvent.id;
      }
    } else {
      this.logError("Claude Code execution failed", result.error);
    }

    return result.success;
  } catch (error) {
    this.logError("Error triggering Claude Code", error);
    return false;
  }
}