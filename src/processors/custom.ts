import { MessageObject } from '../types';

import { MessageProcessor } from '../types';

export function createCustomProcessor({
  name,
  processBatch,
  processBatchSync,
}: {
  name: string;
  processBatch: (messages: MessageObject[]) => Promise<void>;
  processBatchSync?: (messages: MessageObject[]) => void;
}): MessageProcessor {
  return {
    type: 'external',
    name,
    processBatch: processBatch || processBatchSync,
    processBatchSync: processBatchSync || processBatch,
  };
}
