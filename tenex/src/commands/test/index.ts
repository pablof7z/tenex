import { Command } from 'commander';
import { createTestConversationCommand } from './conversation';
import { createTestPhasesCommand } from './phases';
import { createTestIntegrationCommand } from './integration';
import { createTestAgentExecutionCommand } from './agent-execution';

export function createTestCommand(): Command {
  const command = new Command('test')
    .description('Test various TENEX components');

  command.addCommand(createTestConversationCommand());
  command.addCommand(createTestPhasesCommand());
  command.addCommand(createTestIntegrationCommand());
  command.addCommand(createTestAgentExecutionCommand());

  return command;
}