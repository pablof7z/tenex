import { Conversation } from '../Conversation';
import { Logger } from './Logger';

/**
 * Configuration for LLM providers
 */
export interface LLMProvider {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
}

/**
 * Options for the conversation simulator
 */
export interface ConversationSimulatorOptions {
  llmProvider: LLMProvider;
  userPersona?: string;
  conversationGoal?: string;
  maxTurns?: number;
  turnDelay?: number; // Delay between turns in ms
  debug?: boolean;
}

/**
 * Response from the LLM
 */
interface LLMResponse {
  message: string;
  shouldContinue: boolean;
  reasoning?: string;
}

/**
 * Simulates a human user having a conversation with TENEX using an LLM.
 * This allows for realistic E2E testing of multi-turn conversations.
 */
export class LLMConversationSimulator {
  private logger: Logger;
  
  constructor(private options: ConversationSimulatorOptions) {
    this.logger = new Logger({ 
      component: 'LLMSimulator',
      debug: options.debug 
    });
  }
  
  /**
   * Simulates a conversation between an LLM (acting as human) and TENEX
   * 
   * @param conversation - The TENEX conversation to interact with
   * @param initialMessage - The first message to send
   * @returns Array of message exchanges
   */
  async simulateConversation(
    conversation: Conversation,
    initialMessage: string
  ): Promise<Array<{ role: 'user' | 'assistant', message: string }>> {
    const exchanges: Array<{ role: 'user' | 'assistant', message: string }> = [];
    const maxTurns = this.options.maxTurns || 10;
    const turnDelay = this.options.turnDelay || 2000;
    
    // Send initial message
    this.logger.info('Starting conversation simulation', { initialMessage });
    exchanges.push({ role: 'user', message: initialMessage });
    
    // Initial message is already sent when conversation was started
    let lastAssistantMessage = '';
    
    for (let turn = 0; turn < maxTurns; turn++) {
      this.logger.debug(`Turn ${turn + 1} of ${maxTurns}`);
      
      // Wait for TENEX response
      try {
        const response = await conversation.waitForReply({
          timeout: 60000, // 1 minute timeout per response
          afterMessage: turn === 0 ? undefined : exchanges[exchanges.length - 1].message
        });
        
        lastAssistantMessage = response.content;
        exchanges.push({ role: 'assistant', message: lastAssistantMessage });
        this.logger.debug('Received TENEX response', { 
          response: lastAssistantMessage.substring(0, 100) + '...' 
        });
        
        // Check if conversation reached a natural end
        if (this.isConversationComplete(lastAssistantMessage)) {
          this.logger.info('Conversation reached natural completion');
          break;
        }
        
        // Generate next user message
        const userResponse = await this.generateUserResponse(exchanges);
        
        if (!userResponse.shouldContinue) {
          this.logger.info('LLM decided to end conversation', { 
            reasoning: userResponse.reasoning 
          });
          break;
        }
        
        // Send user response
        exchanges.push({ role: 'user', message: userResponse.message });
        await conversation.sendMessage(userResponse.message);
        this.logger.debug('Sent user response', { 
          message: userResponse.message.substring(0, 100) + '...' 
        });
        
        // Delay between turns to simulate human typing
        await new Promise(resolve => setTimeout(resolve, turnDelay));
        
      } catch (error) {
        this.logger.error('Error during conversation turn', { 
          turn, 
          error: (error as Error).message 
        });
        break;
      }
    }
    
    this.logger.info('Conversation simulation completed', { 
      totalExchanges: exchanges.length 
    });
    return exchanges;
  }
  
  /**
   * Generate a user response based on conversation history
   */
  private async generateUserResponse(
    exchanges: Array<{ role: 'user' | 'assistant', message: string }>
  ): Promise<LLMResponse> {
    const systemPrompt = this.buildSystemPrompt();
    const conversationHistory = this.formatConversationHistory(exchanges);
    
    const prompt = `${systemPrompt}

Conversation so far:
${conversationHistory}

Based on the conversation above, generate your next response as the user. Consider:
1. Whether the conversation goal has been achieved
2. Whether to ask follow-up questions or provide more details
3. Whether to naturally end the conversation

Respond in JSON format:
{
  "message": "Your message to the assistant",
  "shouldContinue": true/false,
  "reasoning": "Brief explanation of your decision"
}`;

    try {
      const response = await this.callLLM(prompt);
      const parsed = JSON.parse(response);
      
      return {
        message: parsed.message,
        shouldContinue: parsed.shouldContinue,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      this.logger.error('Failed to generate user response', { error });
      // Fallback response
      return {
        message: "Thank you for your help!",
        shouldContinue: false,
        reasoning: "Error generating response, ending conversation"
      };
    }
  }
  
  /**
   * Build the system prompt for the LLM acting as user
   */
  private buildSystemPrompt(): string {
    const persona = this.options.userPersona || 
      "a software developer looking to build a new project";
    
    const goal = this.options.conversationGoal || 
      "brainstorm and plan a new software project";
    
    return `You are simulating ${persona}. Your goal is to ${goal}.

Be natural and conversational. Ask clarifying questions when appropriate. 
Provide realistic details and requirements. Stay focused on the goal but 
allow for organic conversation flow.

Important: You are the USER talking to an AI assistant (TENEX). The assistant 
will help you plan and build your project.`;
  }
  
  /**
   * Format conversation history for the prompt
   */
  private formatConversationHistory(
    exchanges: Array<{ role: 'user' | 'assistant', message: string }>
  ): string {
    return exchanges
      .map(ex => `${ex.role === 'user' ? 'User' : 'Assistant'}: ${ex.message}`)
      .join('\n\n');
  }
  
  /**
   * Check if TENEX response indicates conversation completion
   */
  private isConversationComplete(message: string): boolean {
    const completionPhrases = [
      'project has been created',
      'project is ready',
      'successfully created',
      'you can now start',
      'implementation is complete',
      'build is complete'
    ];
    
    const lowerMessage = message.toLowerCase();
    return completionPhrases.some(phrase => lowerMessage.includes(phrase));
  }
  
  /**
   * Call the LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const { provider, model, apiKey } = this.options.llmProvider;
    
    if (provider === 'openai') {
      return this.callOpenAI(prompt, model, apiKey);
    } else if (provider === 'anthropic') {
      return this.callAnthropic(prompt, model, apiKey);
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
  
  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string, model: string, apiKey: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
}