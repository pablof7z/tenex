import type { MessageHandler, RoutingContext } from "./types";
import { logger } from "@/utils/logger";

export class RoutingPipeline {
  constructor(private handlers: MessageHandler[]) {}

  async execute(context: RoutingContext): Promise<RoutingContext> {
    logger.debug("Starting routing pipeline", {
      conversationId: context.conversation.id,
      phase: context.conversation.phase,
      handlers: this.handlers.map(h => h.name)
    });

    for (const handler of this.handlers) {
      if (handler.canHandle(context)) {
        logger.debug(`Executing handler: ${handler.name}`, {
          conversationId: context.conversation.id
        });
        
        try {
          context = await handler.handle(context);
          
          if (context.handled) {
            logger.debug(`Handler ${handler.name} completed request`, {
              conversationId: context.conversation.id
            });
            break;
          }
        } catch (error) {
          logger.error(`Handler ${handler.name} failed`, {
            error,
            conversationId: context.conversation.id
          });
          context.error = error instanceof Error ? error : new Error(String(error));
          break;
        }
      }
    }

    if (!context.handled && !context.error) {
      logger.warn("No handler processed the request", {
        conversationId: context.conversation.id,
        event: context.event.id
      });
    }

    return context;
  }

  addHandler(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  getHandlers(): MessageHandler[] {
    return [...this.handlers];
  }
}