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

    let currentContext = context;

    for (const handler of this.handlers) {
      if (handler.canHandle(currentContext)) {
        logger.debug(`Executing handler: ${handler.name}`, {
          conversationId: currentContext.conversation.id
        });
        
        try {
          currentContext = await handler.handle(currentContext);
          
          if (currentContext.handled) {
            logger.debug(`Handler ${handler.name} completed request`, {
              conversationId: currentContext.conversation.id
            });
            break;
          }
        } catch (error) {
          logger.error(`Handler ${handler.name} failed`, {
            error,
            conversationId: currentContext.conversation.id
          });
          currentContext.error = error instanceof Error ? error : new Error(String(error));
          break;
        }
      }
    }

    if (!currentContext.handled && !currentContext.error) {
      logger.warn("No handler processed the request", {
        conversationId: currentContext.conversation.id,
        event: currentContext.event.id
      });
    }

    return currentContext;
  }

  addHandler(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  getHandlers(): MessageHandler[] {
    return [...this.handlers];
  }
}