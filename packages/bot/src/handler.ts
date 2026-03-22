export interface BotMessageContext {
  readonly from: string;
  readonly text: string;
}

export type BotMessageHandler = (context: BotMessageContext) => Promise<string | void>;

export function createMessageContext(from: string, text: string): BotMessageContext {
  return {
    from,
    text
  };
}
