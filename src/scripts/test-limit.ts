import { Message } from '../types';

import { createMessageBatcher } from '../batcher.js';
import { MessageProcessor } from '../types';
import { addErrorPatterns } from '../utils/classify';

const mockProcessor: MessageProcessor = {
  name: 'mock',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  processBatch: async (_messages: Message[]) => {
    // console.log('Processing batch:', messages);
  },
};

addErrorPatterns([
  {
    name: 'test',
    pattern: /test/,
    category: 'test',
    severity: 'info',
  },
]);

const batcher = createMessageBatcher({
  maxBatchSize: 100000,
  maxWaitMs: 1000,
  concurrentProcessors: 1,
  processors: [mockProcessor],
});

let i = 0;
(async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    batcher.info('test');
    i++;
    // console.log(i);
    if (i % 1_000_000 === 0) {
      console.log(i);
    }
    // await new Promise((resolve) => setTimeout(resolve, 1));
  }
})();

process.on('uncaughtException', () => {
  console.error(i);
});
process.on('unhandledRejection', () => {
  console.error(i);
});
