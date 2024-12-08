import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
  type MessageBatcher,
} from './types';

// Export for testing
let globalBatcher: MessageBatcher | null = null;
export function createMessageBatcher(
  processors: MessageProcessor[],
  config: Required<BatcherConfig>
): MessageBatcher {
  if (globalBatcher) {
    return globalBatcher;
  }

  let processInterval: NodeJS.Timeout | null = null;
  const queues: Map<string, Message[]> = new Map();
  const timers: Map<string, NodeJS.Timeout> = new Map();
  let extraProcessors: MessageProcessor[] = [];
  const processorNames = new Set(processors.map((p) => p.name));

  function startProcessing(): void {
    processInterval = setInterval(async () => {
      for (const chatId of queues.keys()) {
        await processBatch(chatId);
      }
    }, config.maxWaitMs);
  }

  function addExtraProcessor(processor: MessageProcessor): void {
    if (!processorNames.has(processor.name)) {
      console.error(`Processor ${processor.name} not found in main processors`);
      return;
    }
    extraProcessors.push(processor);
  }

  function removeExtraProcessor(processor: MessageProcessor): void {
    if (!processorNames.has(processor.name)) {
      console.error(`Processor ${processor.name} not found in main processors`);
      return;
    }
    extraProcessors = extraProcessors.filter((p) => p !== processor);
    processorNames.delete(processor.name);
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
    if (!queues.has(chatId)) {
      queues.set(chatId, []);
    }

    const queue = queues.get(chatId) ?? [];
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

  // Helper function for concurrent processing
  async function processInBatches<T>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<void>
  ): Promise<void> {
    const chunks = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(processor));
    }
  }

  async function processBatch(chatId: string): Promise<void> {
    const queue = queues.get(chatId);
    if (!queue?.length) return;

    // Clear any pending timer for this batch
    const timer = timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(chatId);
    }

    const batch = [...queue];
    queues.set(chatId, []);

    try {
      const allProcessors = [...processors, ...extraProcessors];
      await processInBatches(
        allProcessors,
        3, // Process 3 processors concurrently
        async (processor) => {
          try {
            await processor.processBatch(batch);
          } catch (error) {
            console.error(`Processor ${processor.name} failed:`, error);
          }
        }
      );
    } catch (error) {
      console.error('Error processing batch:', error);
    }
  }

  function processBatchSync(chatId: string): void {
    const queue = queues.get(chatId);
    if (!queue?.length) return;

    const batch = [...queue];
    queues.set(chatId, []);

    for (const processor of processors) {
      try {
        if (processor.processBatchSync) {
          processor.processBatchSync(batch);
        } else {
          // Handle async processBatch by ignoring the Promise
          (processor.processBatch(batch) as Promise<void>).catch((error) => {
            console.error(`Processor ${processor.name} failed:`, error);
          });
        }
      } catch (error) {
        console.error(`Processor ${processor.name} failed:`, error);
      }
    }
  }

  async function flush(): Promise<void> {
    for (const chatId of queues.keys()) {
      await processBatch(chatId);
    }
  }

  function flushSync(): void {
    for (const chatId of queues.keys()) {
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
    queues.clear();
  }

  startProcessing();

  globalBatcher = {
    info,
    warning,
    error,
    queueMessage,
    processBatch,
    flush,
    flushSync,
    destroy,
    queues,
    timers,
    addExtraProcessor,
    removeExtraProcessor,
  };
  return globalBatcher;
}
