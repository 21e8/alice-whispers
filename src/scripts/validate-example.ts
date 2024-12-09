import { createMessageBatcher } from '../batcher.js';
import { createTelegramProcessor } from '../processors/telegram.js';
import { addErrorPatterns } from '../utils/classify.js';

async function validateExample() {
  console.log('Starting example validation...');

  // Configure error patterns for aggregation
  addErrorPatterns([
    {
      name: 'rateLimit',
      pattern: /rate limit exceeded/i,
      category: 'RATE_LIMIT',
      severity: 'high',
      aggregation: {
        windowMs: 5000, // 5 second window
        countThreshold: 5, // Aggregate after 5 occurrences
      },
    },
    {
      name: 'burstStart',
      pattern: /Starting burst \d+ of operations/i,
      category: 'BURST_START',
      severity: 'low',
      aggregation: {
        windowMs: 5000,
        countThreshold: 2,
      },
    },
    {
      name: 'burstComplete',
      pattern: /Completed burst \d+ with \d+ operations/i,
      category: 'BURST_COMPLETE',
      severity: 'low',
      aggregation: {
        windowMs: 5000,
        countThreshold: 2,
      },
    },
    {
      name: 'progressInfo',
      pattern: /Processed \d+ operations in burst \d+/i,
      category: 'PROGRESS_UPDATE',
      severity: 'low',
      aggregation: {
        windowMs: 5000,
        countThreshold: 2,
      },
    },
  ]);

  // Create a mock Telegram processor for testing
  const mockTelegram = createTelegramProcessor({
    botToken: 'test-token',
    chatId: 'test-chat',
    development: true, // Use development mode to prevent actual API calls
  });

  // Create processor with optimized settings for high throughput
  const batcher = createMessageBatcher({
    maxBatchSize: 100_000, // Much larger batches
    maxWaitMs: 20, // Process very frequently
    concurrentProcessors: 5, // More concurrent processors
  });

  // Add the mock processor
  batcher.addProcessor(mockTelegram);

  console.log('Sending test messages in bursts...');
  const startTime = Date.now();
  const totalMessages = 100_000; // 100k messages
  const burstSize = 5000; // Larger bursts
  const bursts = Math.ceil(totalMessages / burstSize);

  // Send messages in bursts to test both batching and error aggregation
  for (let burst = 0; burst < bursts; burst++) {
    const burstStart = Date.now();

    // Send info message at start of burst
    batcher.info(`Starting burst ${burst + 1} of operations`);

    // Send a burst of rate limit errors
    for (let i = 0; i < burstSize; i++) {
      try {
        throw new Error('rate limit exceeded');
      } catch (error) {
        batcher.error(`rate limit exceeded`, error as Error);
      }

      // Add info messages less frequently
      if (i % 1000 === 0) {
        batcher.info(`Processed ${i} operations in burst ${burst + 1}`);
      }
    }

    // Send info message at end of burst
    batcher.info(`Completed burst ${burst + 1} with ${burstSize} operations`);

    const burstDuration = Date.now() - burstStart;
    console.log(`Burst ${burst + 1} took ${burstDuration}ms`);
  }

  // Wait for processing to complete
  console.log('\nWaiting for messages to be processed...');
  await batcher.flush();

  const endTime = Date.now();
  const duration = endTime - startTime;
  const totalProcessed = totalMessages + bursts * 7; // errors + info messages

  console.log(`\nValidation complete:`);
  console.log(
    `- Processed ${totalProcessed.toLocaleString()} messages in ${duration}ms`
  );
  console.log(
    `- Average time per message: ${(duration / totalProcessed).toFixed(3)}ms`
  );
  console.log(
    `- Messages per second: ${Math.round(
      (totalProcessed / duration) * 1000
    ).toLocaleString()}`
  );
  console.log(
    `- Messages were sent in ${bursts} bursts of ${burstSize.toLocaleString()} operations each`
  );
  console.log(
    '- Each burst included start/end info messages and progress updates'
  );
  console.log(
    '- Error aggregation should have reduced the number of error messages'
  );

  // Clean up
  await batcher.destroy();
}

// Run the validation
validateExample().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
