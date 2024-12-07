import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
  type MessageBatcher,
} from './types';

// Export for testing
export const globalQueues: Map<string, Message[]> = new Map();
export const timers: Map<string, NodeJS.Timeout> = new Map();

export function createMessageBatcher(
  processors: MessageProcessor[],
  config: Required<BatcherConfig>
): MessageBatcher {
  let processInterval: NodeJS.Timeout | null = null;

  function startProcessing(): void {
    processInterval = setInterval(() => {
      for (const chatId of globalQueues.keys()) {
        processBatch(chatId);
      }
    }, config.maxWaitMs);
  }

  function info(message: string): void {
    queueMessage(message, 'info');
  }

  function warning(message: string): void {
    queueMessage(message, 'warning');
  }

  function error(message: string, error?: Error | string): void {
    queueMessage(message, 'error', error);
  }
  function queueMessage(
    message: string,
    level: NotificationLevel,
    error?: Error | string
  ): void {
    const chatId = 'default';
    if (!globalQueues.has(chatId)) {
      globalQueues.set(chatId, []);
    }

    const queue = globalQueues.get(chatId) ?? [];
    queue.push({ chatId, text: message, level, error });

    // Set a timeout to process this batch if maxBatchSize isn't reached
    if (queue.length < config.maxBatchSize) {
      const existingTimer = timers.get(chatId);
      if (!existingTimer) {
        const timer = setTimeout(() => {
          processBatch(chatId);
          timers.delete(chatId);
        }, config.maxWaitMs);
        timers.set(chatId, timer);
      }
    } else {
      // Process immediately if maxBatchSize is reached
      processBatch(chatId);
    }
  }

  async function processBatch(chatId: string): Promise<void> {
    const queue = globalQueues.get(chatId);
    if (!queue?.length) return;

    // Clear any pending timer for this batch
    const timer = timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(chatId);
    }

    const batch = [...queue];
    globalQueues.set(chatId, []);

    const results = await Promise.allSettled(
      processors.map((processor) => processor.processBatch(batch))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected') {
        console.error(`Processor ${i} failed:`, result.reason);
      }
    }
  }

  function processBatchSync(chatId: string): void {
    const queue = globalQueues.get(chatId);
    if (!queue?.length) return;

    const batch = [...queue];
    globalQueues.set(chatId, []);

    for (const item of batch) {
      for (const processor of processors) {
        try {
          if (processor.processBatchSync) {
            processor.processBatchSync([item]);
          } else {
            // Handle async processBatch by ignoring the Promise
            (processor.processBatch([item]) as Promise<void>).catch((error) => {
              console.error(`Processor failed:`, error);
            });
          }
        } catch (error) {
          console.error(`Processor failed:`, error);
        }
      }
    }
  }

  async function flush(): Promise<void> {
    for (const chatId of globalQueues.keys()) {
      await processBatch(chatId);
    }
  }

  function flushSync(): void {
    for (const chatId of globalQueues.keys()) {
      processBatchSync(chatId);
    }
  }

  function destroy(): void {
    if (processInterval) {
      clearInterval(processInterval);
      processInterval = null;
    }
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  // Start processing on creation
  startProcessing();

  // Return a new instance
  return {
    info,
    warning,
    error,
    queueMessage,
    processBatch: processBatch,
    flush,
    flushSync,
    destroy,
  };
}

// Reset function now only clears the queue
export function resetBatcher(): void {
  globalQueues.clear();
}
