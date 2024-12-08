import { createMessageBatcher } from '../batcher.js';
import type { InternalMessageProcessor, Message } from '../types.js';
import Queue from '../utils/queue.js';
const mockProcessor: InternalMessageProcessor = {
  type: 'internal',
  name: 'mock',
  processBatch: async (messages: Queue<Message>) => {
    console.log('Processing batch:', messages);
  },
};

async function testTimeout() {
  console.log('Starting timeout test...');

  const batcher = createMessageBatcher({
    maxBatchSize: 5,
    maxWaitMs: 100,
  });
  batcher.addProcessor(mockProcessor);
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
