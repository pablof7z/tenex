import { Message } from "multi-llm-ts";

export function createMessage(role: string, content: string, extra?: any): Message {
  const message = new Message(role, content);
  if (extra) {
    Object.assign(message, extra);
  }
  return message;
}