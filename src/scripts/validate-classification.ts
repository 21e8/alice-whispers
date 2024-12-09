import { createMessageBatcher } from '../batcher.js';
import { createCustomProcessor } from '../processors/custom.js';
import {
  addErrorPatterns,
  clearErrorPatterns,
} from '../utils/classify.js';
// import { EMOJI_MAP } from '../utils.js';
import type { Message } from '../types.js';

async function validateClassification() {
  console.log('Starting high-volume classification validation...');

  // Clear any existing patterns
  clearErrorPatterns();

  // Configure patterns for different message types
  addErrorPatterns([
    {
      name: 'userAction',
      pattern: /User \w+ performed action/i,
      category: 'USER_ACTIVITY',
      severity: 'low',
      aggregation: {
        windowMs: 1000, // 1 second window
        countThreshold: 100, // Aggregate after 100 similar messages
      },
    },
    {
      name: 'systemStatus',
      pattern: /System (healthy|running|starting)/i,
      category: 'SYSTEM_STATUS',
      severity: 'low',
      aggregation: {
        windowMs: 1000,
        countThreshold: 50,
      },
    },
    {
      name: 'dbError',
      pattern: /database (error|connection failed)/i,
      category: 'DATABASE_ERROR',
      severity: 'high',
      aggregation: {
        windowMs: 1000,
        countThreshold: 20,
      },
    },
  ]);

  // Create a logging processor with counters
  let totalProcessed = 0;
  let aggregatedCount = 0;
  let lastLogTime = Date.now();
  let batchCount = 0;

  const loggingProcessor = createCustomProcessor({
    name: 'logger',
    processBatch: (messages: Message[]) => {
      batchCount++;
      for (const [, text] of messages) {
        if (text.includes('[AGGREGATED]')) {
          const match = text.match(/\[AGGREGATED\] (\d+)/);
          if (match) {
            aggregatedCount += parseInt(match[1], 10);
          }
        }
        totalProcessed++;
      }

      // Log progress every second
      const now = Date.now();
      if (now - lastLogTime > 1000) {
        console.log(
          `Processed ${totalProcessed.toLocaleString()} messages (${aggregatedCount.toLocaleString()} aggregated) in ${batchCount} batches`
        );
        lastLogTime = now;
      }
    },
  });

  // Create batcher with optimized settings for high volume
  const batcher = createMessageBatcher({
    maxBatchSize: 1000, // Larger batches for efficiency
    maxWaitMs: 100, // Process frequently
    concurrentProcessors: 4, // Use more concurrent processors
  });

  // Add the logging processor
  batcher.addProcessor(loggingProcessor);

  const startTime = Date.now();
  const totalMessages = 100_000;
  console.log(`\nSending ${totalMessages.toLocaleString()} messages...`);

  // Mix of different message types
  const messageTypes = [
    () => `System healthy - check ${Math.random()}`,
    () =>
      `User ${
        ['Alice', 'Bob', 'Charlie', 'David'][Math.floor(Math.random() * 4)]
      } performed action`,
    () => `database error: connection ${Math.random()} failed`,
  ];

  // Send messages as fast as possible
  for (let i = 0; i < totalMessages; i++) {
    const messageType = messageTypes[i % messageTypes.length];
    const level = i % 3 === 2 ? 'error' : 'info';
    batcher.queueMessage(messageType(), level);
  }

  console.log('Waiting for processing to complete...');
  await batcher.flush();

  const endTime = Date.now();
  const duration = endTime - startTime;
  const messagesPerSecond = Math.round((totalMessages / duration) * 1000);
  const avgTimePerMessage = duration / totalMessages;

  console.log('\nValidation complete!');
  console.log('Performance metrics:');
  console.log(`- Total time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`- Total messages: ${totalMessages.toLocaleString()}`);
  console.log(`- Messages per second: ${messagesPerSecond.toLocaleString()}`);
  console.log(`- Average time per message: ${avgTimePerMessage.toFixed(3)}ms`);
  console.log(`- Total batches: ${batchCount}`);
  console.log(
    `- Average batch size: ${(totalMessages / batchCount).toFixed(1)}`
  );
  console.log('\nAggregation metrics:');
  console.log(`- Messages aggregated: ${aggregatedCount.toLocaleString()}`);
  console.log(
    `- Aggregation ratio: ${((aggregatedCount / totalMessages) * 100).toFixed(
      1
    )}%`
  );
  console.log(`- Final message count: ${totalProcessed.toLocaleString()}`);
  console.log(
    `- Reduction ratio: ${((1 - totalProcessed / totalMessages) * 100).toFixed(
      1
    )}%`
  );

  // Clean up
  await batcher.destroy();
}

// Run the validation
validateClassification().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});
