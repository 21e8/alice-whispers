import { createMessageBatcher } from '../batcher.js';
import type { Message, MessageProcessor } from '../types.js';

const mockProcessor: MessageProcessor = {
  type: 'external',
  name: 'mock',
  processBatch: async (messages: Message[]) => {
    console.log('Processing batch:', messages);
  },
};

async function testTimeout() {
  console.log('Starting timeout test...');

  const batcher = createMessageBatcher([mockProcessor], {
    maxBatchSize: 5,
    maxWaitMs: 100,
  });

  console.log('Sending first message...');
  batcher.info('First message');

  await new Promise((resolve) => setTimeout(resolve, 40));

  console.log('Sending second message...');
  batcher.info('Second message');

  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log('Test complete. Cleaning up...');
  batcher.destroy();
}

// Run the test
testTimeout().catch((e) => {
  console.error(e);
  process.exit(1);
});
