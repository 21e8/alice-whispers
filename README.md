# Alice Whispers

Intelligent message batching system that whispers your messages in perfect harmony, with smart batching and error classification.

## Features

- 🎭 Elegant: Beautiful message formatting and intelligent error handling
- 🚀 High Performance: Uses array-based message format for minimal memory overhead
- 🔄 Smart Batching: Automatically batches messages to reduce API calls
- ⚡ Concurrent Processing: Supports multiple processors running in parallel
- 🔌 Extensible: Easy to add custom message processors
- 🎯 Type-Safe: Written in TypeScript with full type coverage
- 🛡️ Error Classification: Built-in error pattern matching and aggregation

## Installation

```bash
# npm
npm install alice-whispers

# yarn
yarn add alice-whispers
```

## Quick Start

```typescript
import {
  createMessageBatcher,
  createTelegramProcessor,
} from 'alice-whispers';

// Create a Telegram processor
const telegramProcessor = createTelegramProcessor({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
  development: process.env.NODE_ENV === 'development',
});

// Create a batcher with the processor
const batcher = createMessageBatcher([telegramProcessor], {
  maxBatchSize: 10, // Process when 10 messages are queued
  maxWaitMs: 5000, // Or when 5 seconds have passed
  concurrentProcessors: 2, // Run up to 2 processors concurrently
});

// Send messages
batcher.info('Service started');
batcher.warning('High memory usage detected');
batcher.error('Database connection failed', new Error('Connection timeout'));

// Force process any remaining messages
await batcher.flush();

// Clean up when done
batcher.destroy();
```

## Custom Processors

Create your own message processors:

```typescript
import { createCustomProcessor, type Message } from 'alice-whispers';

const consoleProcessor = createCustomProcessor({
  name: 'console',
  type: 'external',
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
  (Error | string)? // optional error
];
```

## Error Classification

Built-in error classification and formatting:

```typescript
import { classifyError, formatClassifiedError } from 'alice-whispers';

try {
  // ... your code ...
} catch (error) {
  const classified = await classifyError(error);
  const formatted = formatClassifiedError(classified);
  batcher.error('Operation failed', formatted);
}
```

## Message Structure

Messages are internally stored as tuples with the following structure:

```typescript
type Message = [
  chatId,     // Position 0: string - Identifier for the chat/channel
  text,       // Position 1: string - The message content
  level,      // Position 2: 'info' | 'warning' | 'error' - Message level
  error?      // Position 3: Optional Error | string - Error details
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
  pattern,    // Position 0: RegExp | function - Pattern to match errors
  category,   // Position 1: string - Category name for grouping similar errors
  severity,   // Position 2: 'low' | 'medium' | 'high' | string - Error severity
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
