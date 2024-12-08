import type { Message, MessageProcessor } from '../types';
import Queue from '../utils/queue';

export function createCustomProcessor({
  name,
  processBatch,
  processBatchSync,
}: {
  name: string;
  processBatch: (messages: Message[]) => Promise<void>;
  processBatchSync?: (messages: Message[]) => void;
}): MessageProcessor {
  return {
    type: 'external',
    name,
    processBatch: (queue: Queue<Message>) => {
      const arr: Message[] = [];
      while (queue.size > 0) {
        const item = queue.dequeue();
        if (item) {
          arr.push(item);
        }
      }
      return processBatch(arr);
    },
    processBatchSync: (queue: Queue<Message>) => {
      const arr: Message[] = [];
      while (queue.size > 0) {
        const item = queue.dequeue();
        if (item) {
          arr.push(item);
        }
      }
      return processBatchSync?.(arr);
    },
  };
}
