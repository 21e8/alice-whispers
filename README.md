# Alice Whispers 🌸

Intelligent message batching system that whispers your messages in perfect harmony, with smart batching and error classification.

## Features

- **High Performance Message Batching**: Process thousands of messages per second with minimal overhead
- **Smart Error Classification**: Automatically classify and aggregate similar errors
- **Queue-Based Architecture**: Uses efficient FIFO queues for all append-only operations
- **Flexible Processor System**: Support for Telegram and custom message processors
- **Intelligent Error Aggregation**: Reduces noise by grouping similar errors within time windows
- **Type-Safe**: Written in TypeScript with full type safety

## Performance

- Processes 100,000+ messages in under 6 seconds
- Average processing time of 0.06ms per message
- Memory-efficient queue-based implementation
- Concurrent processor support for high throughput

## Architecture

### Queue-Based Design

Alice Whispers uses queues as its primary data structure for several key reasons:

1. **Append-Only Efficiency**: All message operations (batching, error tracking, pattern matching) are append-only by nature. Queues provide O(1) append and O(1) dequeue operations, making them ideal for high-throughput message processing.

2. **Memory Efficiency**: Unlike arrays that may require resizing and copying, our queue implementation maintains a linked structure that grows efficiently with message volume.

3. **FIFO Guarantee**: Messages are processed in the exact order they are received, which is crucial for maintaining message context and proper error aggregation.

4. **Iterator Support**: Our Queue implementation provides standard iterator support, making it easy to process messages in sequence while maintaining clean code.

The Queue class is exported and can be used directly if needed:
```typescript
import { Queue } from 'alice-whispers';

const messageQueue = new Queue<string>();
messageQueue.enqueue('Hello');
const message = messageQueue.dequeue(); // FIFO order
```

## Key Benefits

- 🚀 **High-Volume Processing** - Efficiently funnel thousands of messages into smart batches, reducing noise and system load
- 📊 **Smart Aggregation** - Automatically combines similar messages and errors within configurable time windows
- 🎯 **Noise Reduction** - Turn message floods into meaningful, actionable updates
- 🔄 **Resource Efficient** - Optimized for minimal memory usage with array-based message format
- 🎭 **Zero Dependencies** - Only TypeScript as a peer dependency, keeping your project lean and secure

## Features

- 🔄 Smart message batching with configurable batch sizes and timing
- 🎯 Intelligent error classification and pattern matching
- 📊 Error aggregation with customizable time windows
- 🚀 High Performance: Uses array-based message format for minimal memory overhead
- 🔌 Extensible processor system for custom implementations
- 🎭 Elegant: Beautiful message formatting and intelligent error handling
- 💪 Written in TypeScript with full type safety
- **High-Performance Message Processing**

  - Process 250,000+ messages per second
  - Handle bursts of 5,000 messages in 10-20ms
  - Average processing time of 0.004ms per message

- **Intelligent Message Aggregation**

  - Automatically group similar messages within time windows
  - Reduce thousands of messages to meaningful summaries
  - Configurable aggregation patterns and thresholds

- **Efficient Resource Usage**

  - Optimized memory footprint
  - Concurrent message processing
  - Smart batching with configurable sizes

- **Developer-Friendly**
  - Full TypeScript support
  - Easy to configure and extend
  - Comprehensive error handling

## Installation

```bash
# npm
npm install alice-whispers

# yarn
yarn add alice-whispers
```

## Quick Start

```typescript
import { createMessageBatcher, createTelegramProcessor } from 'alice-whispers';

// Create a Telegram processor
const telegramProcessor = createTelegramProcessor({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
  development: process.env.NODE_ENV === 'development',
});

// Create a batcher with the processor
const batcher = createMessageBatcher({
  maxBatchSize: 10, // Process when 10 messages are queued
  maxWaitMs: 5000, // Or when 5 seconds have passed
  concurrentProcessors: 2, // Run up to 2 processors concurrently
});

// Add the processor to the batcher
batcher.addProcessor(telegramProcessor);

// Send messages
batcher.info('Service started');
batcher.warning('High memory usage detected');
batcher.error('Database connection failed', new Error('Connection timeout'));

// Force process any remaining messages
await batcher.flush();

// Clean up when done
batcher.destroy();
```

## High-Volume Example

Handle thousands of messages with smart batching and aggregation:

```typescript
import {
  createMessageBatcher,
  createTelegramProcessor,
  addErrorPatterns,
} from 'alice-whispers';

// Configure error patterns for aggregation
addErrorPatterns([
  {
    name: 'rateLimit',
    pattern: /rate limit exceeded/i,
    category: 'RATE_LIMIT',
    severity: 'high',
    aggregation: {
      windowMs: 60000, // 1 minute window
      countThreshold: 10, // Aggregate after 10 occurrences
    },
  },
]);

// Create processor with larger batch size
const batcher = createMessageBatcher({
  maxBatchSize: 100, // Process in batches of 100
  maxWaitMs: 30000, // Or every 30 seconds
  concurrentProcessors: 3, // Run multiple processors in parallel
});

// Add your processors
batcher.addProcessor(
  createTelegramProcessor({
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    chatId: process.env.TELEGRAM_CHAT_ID!,
  })
);

// Simulate high-volume message processing
for (let i = 0; i < 1000; i++) {
  try {
    // Your application logic
    throw new Error('rate limit exceeded');
  } catch (error) {
    batcher.error(`Operation ${i} failed`, error);
  }
}

// Instead of 1000 separate messages, you'll get aggregated updates like:
// "🚨 [AGGREGATED] 127 similar RATE_LIMIT errors in last 60s"
```

## Custom Processors

Create your own message processors:

```typescript
import { createCustomProcessor, type Message } from 'alice-whispers';

const consoleProcessor = createCustomProcessor({
  name: 'console',
  processBatch: async (messages: Message[]) => {
    for (const msg of messages) {
      console.log(`[${msg[2].toUpperCase()}] ${msg[1]}`);
    }
  },
});

// Add to batcher
const batcher = createMessageBatcher([consoleProcessor], config);
```

## Message Format

Messages are stored internally as arrays for performance:

```typescript
type Message = [
  string, // chatId
  string, // text
  NotificationLevel, // 'info' | 'warning' | 'error'
  (Error | any)? // optional error
];
```

## Message Classification and Aggregation

The library includes built-in message classification and aggregation for any message type (info, warning, or error):

```typescript
import { addErrorPatterns } from 'alice-whispers';

// Configure patterns for message classification and aggregation
addErrorPatterns([
  {
    name: 'startupInfo',
    pattern: /starting batch process/i,
    category: 'STARTUP',
    severity: 'low',
    aggregation: {
      windowMs: 60000, // 1 minute window
      countThreshold: 5, // Aggregate after 5 similar messages
    },
  },
  {
    name: 'rateLimit',
    pattern: /rate limit exceeded/i,
    category: 'RATE_LIMIT',
    severity: 'high',
    aggregation: {
      windowMs: 60000,
      countThreshold: 10,
    },
  },
  {
    name: 'progressUpdate',
    pattern: /processed \d+ items/i,
    category: 'PROGRESS',
    severity: 'low',
    aggregation: {
      windowMs: 30000, // 30 second window
      countThreshold: 3,
    },
  },
]);

// Messages will be automatically classified and aggregated
batcher.info('Starting batch process'); // Will be aggregated if 5+ similar messages in 1 min
batcher.error('Rate limit exceeded'); // Will be aggregated if 10+ similar errors in 1 min
batcher.info('Processed 100 items'); // Will be aggregated if 3+ similar messages in 30s

// Instead of many separate messages, you'll get aggregated updates like:
// "ℹ️ [AGGREGATED] 5 similar STARTUP messages in last 60s"
// "🚨 [AGGREGATED] 15 similar RATE_LIMIT errors in last 60s"
// "ℹ️ [AGGREGATED] 10 PROGRESS updates in last 30s"
```

Messages are classified based on pattern matching (regex or custom function) and can be aggregated based on configurable thresholds. This helps reduce noise while still maintaining visibility into system behavior.

## Message Structure

Messages are internally stored as tuples with the following structure:

```typescript
type Message = [
  chatId, // Position 0: string - Identifier for the chat/channel
  text, // Position 1: string - The message content
  level, // Position 2: 'info' | 'warning' | 'error' - Message level
  error? // Position 3: Optional Error | string - Error details
];
```

- **Position 0 (chatId)**: String identifier for the target chat or channel
- **Position 1 (text)**: The actual message content to be sent
- **Position 2 (level)**: Notification level indicating message importance
- **Position 3 (error)**: Optional error object or string for error messages

## Error Pattern Structure

Error patterns are internally stored as tuples with the following structure:

```typescript
type ErrorPattern = readonly [
  pattern, // Position 0: RegExp | function - Pattern to match errors
  category, // Position 1: string - Category name for grouping similar errors
  severity, // Position 2: 'low' | 'medium' | 'high' | string - Error severity
  [windowMs, countThreshold]? // Position 3: Optional aggregation settings
];
```

- **Position 0 (pattern)**: Can be a RegExp or a function that returns boolean/Promise<boolean>
- **Position 1 (category)**: String identifier to group similar errors
- **Position 2 (severity)**: Error severity level ('low', 'medium', 'high', or custom string)
- **Position 3 (aggregation)**: Optional tuple of [windowMs, countThreshold]
  - windowMs: Time window in milliseconds for aggregation
  - countThreshold: Number of occurrences needed to trigger aggregation

## Advanced Usage

### Multiple Processors

```typescript
const batcher = createMessageBatcher(
  [telegramProcessor, consoleProcessor, emailProcessor],
  config
);
```

### Dynamic Processor Management

```typescript
// Add processor
batcher.addExtraProcessor(newProcessor);

// Remove processor
batcher.removeExtraProcessor('processor-name');

// Remove all extra processors
batcher.removeAllExtraProcessors();
```

### Sync vs Async Processing

```typescript
const processor = createCustomProcessor({
  name: 'hybrid',
  // Async processing
  processBatch: async (messages) => {
    await someAsyncOperation(messages);
  },
  // Sync processing (optional)
  processBatchSync: (messages) => {
    synchronousOperation(messages);
  },
});
```

## Best Practices

1. **Message Batching**: Configure `maxBatchSize` and `maxWaitMs` based on your needs:

   - High volume: Lower `maxWaitMs`, higher `maxBatchSize`
   - Low latency: Lower `maxBatchSize`, lower `maxWaitMs`

2. **Error Handling**: Always use the error parameter in error messages:

   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     batcher.error('Operation failed', error);
   }
   ```

3. **Resource Cleanup**: Always call `destroy()` when done:

   ```typescript
   process.on('SIGTERM', () => {
     batcher.destroy();
   });
   ```

4. **Development Mode**: Use development mode for testing:
   ```typescript
   const processor = createTelegramProcessor({
     ...config,
     development: process.env.NODE_ENV !== 'production',
   });
   ```

## License

MIT © 0xAlice

## Performance

In our validation tests on an M3 Pro, the system demonstrates exceptional performance:

- **Throughput**: Processes 100,000+ messages in under 400ms
- **Speed**: Average processing time of 0.004ms per message
- **Scalability**: Handles 250,000+ messages per second
- **Efficiency**: Aggregates thousands of similar messages into meaningful summaries
- **Batching**: Processes bursts of 5,000 messages in 10-20ms
- **Memory**: Maintains stable memory usage even at high volumes

Example of message reduction through aggregation:

```
Input: 100,140 total messages
- 100,000 error messages
- 140 info messages

Output: Aggregated to just 4 meaningful messages:
🚨 99,862 error messages of category RATE_LIMIT occurred
ℹ️ 20 info messages of category BURST_COMPLETE occurred
ℹ️ Progress updates aggregated by category
ℹ️ Burst starts aggregated by category
```

## Queue Implementation

The library uses a custom Queue data structure (inspired by [yocto-queue](https://github.com/sindresorhus/yocto-queue)) for efficient message handling. The Queue provides constant time O(1) operations for both enqueue and dequeue operations, making it ideal for high-throughput message processing.

### Why Use a Queue?
- **Constant Time Operations**: Both enqueue and dequeue are O(1), unlike arrays where shift() is O(n)
- **Memory Efficient**: Uses a linked list internally, no array resizing or copying
- **FIFO Guarantee**: Messages are processed in the exact order they were received
- **Iterator Support**: Can be used in for...of loops and spread operations

### Queue Methods
```typescript
const queue = new Queue<Message>();

// Add items - O(1)
queue.enqueue(message);

// Remove and return first item - O(1)
const message = queue.dequeue();

// Get size - O(1)
const size = queue.size;

// Convert to array - O(n)
const array = queue.toArray();
// or
const array = [...queue];

// Clear all items - O(1)
queue.clear();
```

### Converting Between Arrays and Queues
```typescript
// Array to Queue
const array = [1, 2, 3];
const queue = new Queue(array);

// Queue to Array
const array = queue.toArray();
// or use spread operator
const array = [...queue];
```

The Queue is used internally for message batching and error collection, but when interfacing with external processors, the messages are converted to arrays for better compatibility.
