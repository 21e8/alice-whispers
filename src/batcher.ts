import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
  type MessageBatcher,
  type InternalMessageProcessor,
  type ExternalMessageProcessor,
} from './types';
import Queue from './utils/queue';

// Custom AggregateError implementation
export class BatchAggregateError extends Error {
  readonly errors: Error[];

  constructor(errors: Error[], message: string) {
    super(message);
    this.name = 'BatchAggregateError';
    this.errors = errors;
  }
}

export const globalBatchers = new Map<string, MessageBatcher>();

export function createMessageBatcher(
  config: BatcherConfig
): MessageBatcher {
  const id = config.id ?? 'default';
  const isSingleton = config.singleton ?? true;
  const existingBatcher = globalBatchers.get(id);
  if (isSingleton && existingBatcher) {
    return existingBatcher;
  }
  let processInterval: NodeJS.Timeout | null = null;
  const queues: Map<string, Queue<Message>> = new Map();
  const timers: Map<string, NodeJS.Timeout> = new Map();
  let extraProcessors: MessageProcessor[] = [];
  const processorNames = new Set<string>();
  const concurrentProcessors = config.concurrentProcessors ?? 3;
  const maxBatchSize = config.maxBatchSize ?? 100;
  const maxWaitMs = config.maxWaitMs ?? 60_000; // 1 minute

  function startProcessing(): void {
    if (processInterval) {
      clearInterval(processInterval);
    }
    processInterval = setInterval(async () => {
      for (const chatId of queues.keys()) {
        await processBatch(chatId);
      }
    }, maxWaitMs);
  }

  function addProcessor(processor: ExternalMessageProcessor | InternalMessageProcessor): void {
    if (processorNames.has(processor.name)) {
      console.error(`Processor ${processor.name} already exists`);
      return;
    }
    if (processor.type === 'external') {
      extraProcessors.push({
        type: 'external',
        name: processor.name,
        processBatch: (queue) => processor.processBatch(queue.toArray()),
        processBatchSync: processor.processBatchSync
          ? (queue) => processor.processBatchSync?.(queue.toArray())
          : undefined,
      });
    } else {
      extraProcessors.push(processor);
    }
    processorNames.add(processor.name);
  }

  function removeProcessor(name: string): void {
    if (!processorNames.has(name)) {
      console.error(`Processor ${name} not found`);
      return;
    }
    extraProcessors = extraProcessors.filter((p) => p.name !== name);
    processorNames.delete(name);
  }

  function removeAllProcessors(): void {
    extraProcessors = [];
    processorNames.clear();
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
      queues.set(chatId, new Queue<Message>());
    }

    const queue = queues.get(chatId) ?? new Queue();
    queue.enqueue([chatId, message, level, error]);

    // Set a timeout to process this batch if maxBatchSize isn't reached
    if (queue.size < maxBatchSize) {
      const existingTimer = timers.get(chatId);
      if (!existingTimer) {
        const timer = setTimeout(() => {
          processBatch(chatId);
          timers.delete(chatId);
        }, maxWaitMs);
        timers.set(chatId, timer);
      }
    } else {
      // Process immediately if maxBatchSize is reached
      processBatch(chatId);
    }
  }

  // Helper function for concurrent processing
  async function concurrentExhaust<T>(
    items: T[],
    concurrency: number,
    processor: (item: T) => Promise<void>
  ): Promise<Error[]> {
    const chunks = [];
    for (let i = 0; i < items.length; i += concurrency) {
      chunks.push(items.slice(i, i + concurrency));
    }

    const errors: Queue<Error> = new Queue();

    for (const chunk of chunks) {
      // Process each item in the chunk and collect results
      const results = await Promise.allSettled(
        chunk.map((item) => processor(item))
      );

      // Check for any rejections
      const chunkErrors = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        )
        .map((result) =>
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason))
        );

      for (const error of chunkErrors) {
        errors.enqueue(error);
      }
    }

    return errors.toArray();
  }

  const exhaustBatcher = async (
    processor: MessageProcessor | InternalMessageProcessor,
    queue: Queue<Message>
  ): Promise<void> => {
    if (typeof processor.processBatch !== 'function') {
      const error = new Error('processBatch is not a function');
      console.error(`Processor ${processor.name} failed:`, error);
      throw error;
    }

    try {
      await processor.processBatch(queue);
    } catch (error) {
      const wrappedError =
        error instanceof Error ? error : new Error(String(error));
      console.error(`Processor ${processor.name} failed:`, wrappedError);
      throw wrappedError;
    }
  };

  async function processBatch(chatId: string): Promise<void> {
    const queue = queues.get(chatId);
    if (!queue?.size) return;

    // Clear any pending timer for this batch
    const timer = timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(chatId);
    }

    // Create a copy of the queue for processing
    const processingQueue = new Queue<Message>();
    while (queue.size > 0) {
      const item = queue.dequeue();
      if (item) {
        processingQueue.enqueue(item);
      }
    }

    const allProcessors = [...extraProcessors];
    const errors = await concurrentExhaust(
      allProcessors,
      concurrentProcessors,
      (processor) => exhaustBatcher(processor, processingQueue)
    );

    if (errors.length > 0) {
      throw new BatchAggregateError(
        errors,
        'Some processors failed to process batch'
      );
    }
  }

  function processBatchSync(chatId: string): void {
    const queue = queues.get(chatId);
    if (!queue?.size) return;

    // Create a copy of the queue for processing
    const processingQueue = new Queue<Message>();
    while (queue.size > 0) {
      const item = queue.dequeue();
      if (item) {
        processingQueue.enqueue(item);
      }
    }

    const errors = new Queue<Error>();

    for (const processor of extraProcessors) {
      try {
        if (processor.processBatchSync) {
          processor.processBatchSync(processingQueue);
        } else if (processor.processBatch) {
          // For async processBatch, we'll catch and log errors
          // We need to handle this differently since we can't await in sync context
          const result = processor.processBatch(processingQueue);
          if (result instanceof Promise) {
            result.catch((error: unknown) => {
              const wrappedError =
                error instanceof Error ? error : new Error(String(error));
              console.error(
                `Processor ${processor.name} failed:`,
                wrappedError
              );
              errors.enqueue(wrappedError);
            });
          }
        }
      } catch (error) {
        const wrappedError =
          error instanceof Error ? error : new Error(String(error));
        console.error(`Processor ${processor.name} failed:`, wrappedError);
        errors.enqueue(wrappedError);
      }
    }

    // If there were any sync errors, throw them
    if (errors.size > 0) {
      throw new BatchAggregateError(
        errors.toArray(),
        'Some batches failed to process'
      );
    }
  }

  async function flush(): Promise<void> {
    const errors = new Queue<Error>();

    for (const chatId of queues.keys()) {
      try {
        await processBatch(chatId);
      } catch (error) {
        if (error instanceof BatchAggregateError) {
          for (const e of error.errors) {
            errors.enqueue(e);
          }
        } else if (error instanceof Error) {
          errors.enqueue(error);
        } else {
          errors.enqueue(new Error(String(error)));
        }
      }
    }

    if (errors.size > 0) {
      throw new BatchAggregateError(
        errors.toArray(),
        'Some batches failed to process during flush'
      );
    }
  }

  function flushSync(): void {
    const errors = new Queue<Error>();

    for (const chatId of queues.keys()) {
      try {
        processBatchSync(chatId);
      } catch (error) {
        if (error instanceof BatchAggregateError) {
          for (const e of error.errors) {
            errors.enqueue(e);
          }
        } else if (error instanceof Error) {
          errors.enqueue(error);
        } else {
          errors.enqueue(new Error(String(error)));
        }
      }
    }

    if (errors.size > 0) {
      throw new BatchAggregateError(
        errors.toArray(),
        'Some batches failed to process during flush'
      );
    }
  }

  async function destroy(): Promise<void> {
    if (processInterval) {
      clearInterval(processInterval);
      processInterval = null;
    }

    // Clear all timers
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    // Process any remaining messages
    try {
      await flush();
    } catch (error) {
      if (error instanceof BatchAggregateError) {
        console.error(
          'Error processing remaining messages during destroy:',
          error
        );
      }
    }

    // Clear all queues
    queues.clear();
    extraProcessors = [];
    processorNames.clear();
  }

  startProcessing();

  const batcher: MessageBatcher = {
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
    addProcessor,
    removeProcessor,
    removeAllProcessors,
  };

  if (isSingleton) {
    globalBatchers.set(id, batcher);
  }

  return batcher;
}
