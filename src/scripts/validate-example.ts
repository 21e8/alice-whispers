import { createMessageBatcher } from '../batcher.js';
import { createTelegramProcessor } from '../processors/telegram.js';
import { addErrorPatterns } from '../utils/errorClassifier.js';

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
        windowMs: 100,      // Small window for testing
        countThreshold: 10  // Aggregate after 10 occurrences
      }
    }
  ]);

  // Create a mock Telegram processor for testing
  const mockTelegram = createTelegramProcessor({
    botToken: 'test-token',
    chatId: 'test-chat',
    development: true // Use development mode to prevent actual API calls
  });

  // Create processor with larger batch size
  const batcher = createMessageBatcher({
    maxBatchSize: 100,     // Process in batches of 100
    maxWaitMs: 100,        // Reduced to 100ms for testing
    concurrentProcessors: 3 // Run multiple processors in parallel
  });

  // Add the mock processor
  batcher.addProcessor(mockTelegram);

  console.log('Sending test messages in bursts...');
  const startTime = Date.now();

  // Send messages in bursts to test both batching and error aggregation
  for (let burst = 0; burst < 5; burst++) {
    console.log(`\nBurst ${burst + 1}:`);
    
    // Send a burst of rate limit errors
    for (let i = 0; i < 50; i++) {
      try {
        throw new Error('rate limit exceeded');
      } catch (error) {
        batcher.error(`Operation ${burst * 50 + i} failed`, error as Error);
      }
      // Small delay between messages in a burst
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Wait between bursts to see aggregation in action
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Wait for processing to complete
  console.log('\nWaiting for messages to be processed...');
  await batcher.flush();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`\nValidation complete:`);
  console.log(`- Processed 250 messages in ${duration}ms`);
  console.log(`- Average time per message: ${duration / 250}ms`);
  console.log('- Messages were sent in 5 bursts of 50 messages each');
  console.log('- Error aggregation should have reduced the number of messages');
  
  // Clean up
  await batcher.destroy();
}

// Run the validation
validateExample().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
}); 