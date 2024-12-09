import type { Message, MessageProcessor } from '../types';

type CustomProcessorConfig = {
  name: string;
  processBatch: (messages: Message[]) => void | Promise<void>;
};

export function createCustomProcessor(config: CustomProcessorConfig): MessageProcessor {
  return {
    name: config.name,
    processBatch: config.processBatch,
  };
}
