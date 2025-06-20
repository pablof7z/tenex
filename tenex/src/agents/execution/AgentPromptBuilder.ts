import type { Agent } from "@/types/agent";
import type { ConversationState } from "@/conversations/types";
import type { Phase } from "@/types/conversation";
import type { AgentPromptContext } from "./types";
import { getProjectContext } from "@/runtime";

export class AgentPromptBuilder {
  static buildSystemPrompt(agent: Agent, phase: Phase): string {
    const projectContext = getProjectContext();
    
    return `You are ${agent.name}, a ${agent.role} working on the ${projectContext.title} project.

## Your Role
${agent.instructions}

## Your Expertise
${agent.expertise}

## Current Phase: ${phase.toUpperCase()}
${this.getPhaseInstructions(phase)}

## Project Context
- Project: ${projectContext.title}
${projectContext.repository ? `- Repository: ${projectContext.repository}` : ''}

## Communication Style
- Be concise and focused on the task at hand
- Provide actionable insights and clear next steps
- When suggesting code changes, be specific about what to change
- Ask clarifying questions when requirements are unclear

## Available Tools
${agent.tools.length > 0 ? agent.tools.join(', ') : 'No tools assigned'}

${agent.tools.length > 0 ? this.getToolInstructions() : ''}

Remember: You are currently in the ${phase} phase. Focus your responses accordingly.`;
  }

  static buildConversationContext(
    conversation: ConversationState,
    maxMessages: number = 10
  ): string {
    const recentHistory = conversation.history.slice(-maxMessages);
    
    const context = recentHistory.map(event => {
      const author = event.tags.find(tag => tag[0] === 'p')?.[1] || 'User';
      const timestamp = new Date(event.created_at! * 1000).toISOString();
      return `[${timestamp}] ${author}: ${event.content}`;
    }).join('\n\n');

    return `## Conversation History

Title: ${conversation.title}
Current Phase: ${conversation.phase}

${context}`;
  }

  static buildPhaseContext(conversation: ConversationState, phase: Phase): string {
    const metadata = conversation.metadata;
    
    switch (phase) {
      case 'chat':
        return `## Phase Context
You are in the requirements gathering phase. Focus on:
- Understanding the user's needs
- Asking clarifying questions
- Identifying technical requirements
- Defining project scope`;

      case 'plan':
        const chatSummary = metadata.chat_summary || metadata.summary || '';
        return `## Phase Context
You are creating an implementation plan based on these requirements:
${chatSummary}

Focus on:
- Breaking down the work into clear tasks
- Identifying technical dependencies
- Suggesting architecture and design patterns
- Creating a realistic timeline`;

      case 'execute':
        const plan = metadata.plan_summary || '';
        return `## Phase Context
You are implementing based on this plan:
${plan}

Focus on:
- Writing clean, maintainable code
- Following best practices
- Implementing features incrementally
- Testing as you go`;

      case 'review':
        const executionSummary = metadata.execute_summary || '';
        const gitBranch = metadata.gitBranch || 'main';
        return `## Phase Context
You are reviewing the implementation:
${executionSummary}

Git Branch: ${gitBranch}

Focus on:
- Code quality and best practices
- Security vulnerabilities
- Performance considerations
- Test coverage
- Documentation completeness`;

      default:
        return '## Phase Context\nNo specific phase context available.';
    }
  }

  static buildFullPrompt(context: AgentPromptContext): string {
    return `${context.systemPrompt}

${context.conversationHistory}

${context.phaseContext}

${context.constraints.length > 0 ? `## Constraints\n${context.constraints.join('\n')}` : ''}

Based on the above context, provide your response as the ${context.phaseContext.includes('Phase:') ? 'assigned expert' : 'project assistant'}.`;
  }

  private static getPhaseInstructions(phase: Phase): string {
    switch (phase) {
      case 'chat':
        return 'Gather requirements and understand the user\'s needs. Ask clarifying questions to ensure you have all necessary information.';
      
      case 'plan':
        return 'Create a detailed implementation plan based on the gathered requirements. Break down the work into manageable tasks.';
      
      case 'execute':
        return 'Implement the features according to the plan. Write clean, well-tested code following best practices.';
      
      case 'review':
        return 'Review the implementation for quality, security, and completeness. Provide constructive feedback and suggestions.';
      
      default:
        return 'Assist with the current task to the best of your ability.';
    }
  }

  private static getToolInstructions(): string {
    return `## Tool Usage Instructions
You can use the following tool patterns in your response:

1. **Execute shell commands:**
   <execute>command here</execute>
   Example: <execute>npm install express</execute>

2. **Read files:**
   <read>path/to/file</read>
   Example: <read>src/index.js</read>

3. **Write files:**
   <write file="path/to/file">content here</write>
   Example: <write file="src/config.json">{"port": 3000}</write>

4. **Edit files:**
   <edit file="path/to/file" from="old content" to="new content"/>
   Example: <edit file="src/app.js" from="const port = 3000" to="const port = process.env.PORT || 3000"/>

5. **Search the web:**
   <search>query</search>
   Example: <search>React hooks best practices</search>

6. **Make API calls:**
   <api method="GET" url="https://api.example.com/data">optional body</api>
   Example: <api method="POST" url="https://api.github.com/repos">{"name": "my-repo"}</api>

Tools will be executed automatically and results will be included in your response.`;
  }
}