import { createMessageBatcher } from '../batcher.js';
import { MessageProcessor, Message } from '../types.js';

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
    maxWaitMs: 2000, // 2 seconds for easier observation
  });

  console.log('Sending first message...');
  batcher.info('First message');

  // Wait 1 second
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('Sending second message...');
  batcher.info('Second message');

  // Wait 3 seconds to ensure the timeout triggers
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('Test complete. Cleaning up...');
  batcher.destroy();
}

// Run the test
testTimeout().catch(console.error);
