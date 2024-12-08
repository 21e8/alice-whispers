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
  processors: InternalMessageProcessor[] | MessageProcessor[],
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

  for (const processor of processors) {
    processorNames.add(processor.name);
  }

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

  function addExtraProcessor(processor: ExternalMessageProcessor): void {
    if (processorNames.has(processor.name)) {
      console.error(`Processor ${processor.name} already exists`);
      return;
    }
    extraProcessors.push(processor);
    processorNames.add(processor.name);
  }

  function removeAllExtraProcessors(): void {
    for (const processor of extraProcessors) {
      if (processor.type === 'external') {
        removeExtraProcessor(processor.name);
      }
    }
    extraProcessors = [];
  }

  function removeExtraProcessor(name: string): void {
    if (!processorNames.has(name)) {
      console.error(`Processor ${name} not found`);
      return;
    }
    extraProcessors = extraProcessors.filter((p) => p.name !== name);
    processorNames.delete(name);
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
    queue: Message[]
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

    queues.set(chatId, new Queue());

    const allProcessors = extraProcessors.length
      ? [...processors, ...extraProcessors]
      : processors;
    const errors = await concurrentExhaust(
      allProcessors as InternalMessageProcessor[],
      concurrentProcessors,
      (processor) => exhaustBatcher(processor, queue.toArray())
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

    queues.set(chatId, new Queue());

    const errors = new Queue<Error>();

    for (const processor of processors) {
      try {
        if (processor.processBatchSync) {
          processor.processBatchSync(queue.toArray());
        } else if (processor.processBatch) {
          // For async processBatch, we'll catch and log errors
          // We need to handle this differently since we can't await in sync context
          const result = processor.processBatch(queue.toArray());
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
        'Some processors failed to process batch'
      );
    }
  }

  async function flush(): Promise<void> {
    const errors = new Queue<Error>();

    // Clear any pending timers first
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    // Process all queues
    for (const chatId of queues.keys()) {
      try {
        await processBatch(chatId);
      } catch (error) {
        if (error instanceof BatchAggregateError) {
          for (const err of error.errors) {
            errors.enqueue(err);
          }
        } else {
          errors.enqueue(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    }

    // If there were any errors, throw a BatchAggregateError
    if (errors.size > 0) {
      throw new BatchAggregateError(
        errors.toArray(),
        'Some batches failed to process during flush'
      );
    }
  }

  function flushSync(): void {
    // Clear any pending timers first
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    const errors = new Queue<Error>();
    for (const chatId of queues.keys()) {
      try {
        processBatchSync(chatId);
      } catch (error) {
        if (error instanceof BatchAggregateError) {
          for (const err of error.errors) {
            errors.enqueue(err);
          }
        } else {
          errors.enqueue(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    }

    // If there were any errors, throw a BatchAggregateError
    if (errors.size > 0) {
      throw new BatchAggregateError(
        errors.toArray(),
        'Some batches failed to process during flush'
      );
    }
  }

  async function destroy(): Promise<void> {
    // Stop the processing interval first
    if (processInterval) {
      clearInterval(processInterval);
      processInterval = null;
    }

    try {
      // Try to process any remaining messages
      await flush();
    } catch (error) {
      if (error instanceof BatchAggregateError) {
        console.error(
          'Error processing remaining messages during destroy:',
          error
        );
      } else {
        const wrappedError = new BatchAggregateError(
          [error instanceof Error ? error : new Error(String(error))],
          'Error processing remaining messages during destroy'
        );
        console.error(
          'Error processing remaining messages during destroy:',
          wrappedError
        );
      }
    } finally {
      // Clean up all resources
      timers.clear();
      queues.clear();
      extraProcessors = [];
      processorNames.clear();
      globalBatchers.delete(id);
    }
  }

  // Initialize processing
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
    addExtraProcessor,
    removeExtraProcessor,
    removeAllExtraProcessors,
  };

  globalBatchers.set(id, batcher);

  return batcher;
}
