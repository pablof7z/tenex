import { Command } from 'commander';
import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { getNDK } from '@/nostr/ndkClient';
import { ConversationManager } from '@/conversations';
import { MultiLLMService } from '@/core/llm/MultiLLMService';
import type { LLMService } from '@/core/llm/types';
import { configurationService } from '@tenex/shared/services';
import { AgentRegistry } from '@/agents';
import { RoutingLLM } from '@/routing';
import { logInfo, logDebug, logError } from '@tenex/shared/logger';
import chalk from 'chalk';

export function createTestConversationCommand(): Command {
  const command = new Command('conversation')
    .description('Test the conversation system with a mock event')
    .option('-m, --message <message>', 'Initial message for the conversation', 'Hello, I need help with a project')
    .option('-t, --title <title>', 'Conversation title', 'Test Conversation')
    .option('-d, --debug', 'Enable debug logging')
    .action(async (options) => {
      if (options.debug) {
        process.env.LOG_LEVEL = 'debug';
      }

      logInfo(chalk.blue('🧪 Testing Conversation System'));
      
      try {
        // Initialize services
        const projectPath = process.cwd();
        const llmConfigManager = new LLMConfigurationAdapter(projectPath);
        await llmConfigManager.loadConfigurations();
        const llmService = new LLMService(llmConfigManager);
        
        const agentRegistry = new AgentRegistry(projectPath);
        await agentRegistry.loadFromProject();
        
        const conversationManager = new ConversationManager(projectPath);
        await conversationManager.initialize();
        
        const routingLLM = new RoutingLLM(llmService);
        
        // Create test conversation
        const userSigner = NDKPrivateKeySigner.generate();
        const event = new NDKEvent(getNDK());
        event.kind = 11;
        event.content = options.message;
        event.tags = [['title', options.title]];
        await event.sign(userSigner);
        
        logInfo(chalk.green('✅ Created test event:'), event.id.substring(0, 8) + '...');
        
        // Test conversation creation
        const conversation = await conversationManager.createConversation(event);
        logInfo(chalk.green('✅ Conversation created:'), {
          id: conversation.id.substring(0, 8) + '...',
          title: conversation.title,
          phase: conversation.phase
        });
        
        // Test routing
        const agents = agentRegistry.getAllAgents();
        if (agents.length === 0) {
          logInfo(chalk.yellow('⚠️  No agents found, creating test agent'));
          await agentRegistry.ensureAgent('test', {
            name: 'Test Agent',
            role: 'Assistant',
            expertise: 'General',
            nsec: '',
            tools: []
          });
        }
        
        const routingDecision = await routingLLM.routeNewConversation(event, agents);
        logInfo(chalk.green('✅ Routing decision:'), routingDecision);
        
        // Test phase transition
        if (routingDecision.phase !== conversation.phase) {
          await conversationManager.updatePhase(conversation.id, routingDecision.phase);
          logInfo(chalk.green('✅ Phase updated:'), `${conversation.phase} → ${routingDecision.phase}`);
        }
        
        logInfo(chalk.blue('\n📊 Test complete!'));
        
      } catch (error) {
        logError('Test failed:', error);
        process.exit(1);
      }
    });

  return command;
}