import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
  type MessageBatcher,
  type InternalMessageProcessor,
  type ExternalMessageProcessor,
} from './types';

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
  const queues: Map<string, Message[]> = new Map();
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
      queues.set(chatId, []);
    }

    const queue = queues.get(chatId) ?? [];
    queue.push([chatId, message, level, error]);

    // Set a timeout to process this batch if maxBatchSize isn't reached
    if (queue.length < maxBatchSize) {
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

    const errors: Error[] = [];

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
        .map((result) => result.reason);

      errors.push(...chunkErrors);
    }

    return errors;
  }

  const exhaustBatcher = async (
    processor: MessageProcessor | InternalMessageProcessor,
    batch: Message[]
  ) => {
    try {
      if (typeof processor.processBatch !== 'function') {
        throw new Error('processBatch is not a function');
      }
      await processor.processBatch(batch);
    } catch (error) {
      console.error(`Processor ${processor.name} failed:`, error);
      throw error;
    }
  };

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

    const allProcessors = [...processors, ...extraProcessors];
    const errors = await concurrentExhaust(
      allProcessors as InternalMessageProcessor[],
      concurrentProcessors,
      (processor) => exhaustBatcher(processor, batch)
    );

    if (errors.length > 0) {
      throw new BatchAggregateError(
        errors.map(e => e instanceof Error ? e : new Error(String(e))),
        'Some processors failed to process batch'
      );
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
        } else if (processor.processBatch) {
          // For async processBatch, we'll catch and log errors
          // We need to handle this differently since we can't await in sync context
          processor.processBatch(batch);
            // .catch((error) => {
            //   console.error(`Processor ${processor.name} failed:`, error);
            // });
        }
      } catch (error) {
        console.error(`Processor ${processor.name} failed:`, error);
        throw error;
      }
    }
  }

  async function flush(): Promise<void> {
    const errors: Error[] = [];
    
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
          errors.push(...error.errors);
        } else {
          errors.push(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }

    // If there were any errors, throw a BatchAggregateError
    if (errors.length > 0) {
      throw new BatchAggregateError(errors, 'Some batches failed to process during flush');
    }
  }

  function flushSync(): void {
    // Clear any pending timers first
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    for (const chatId of queues.keys()) {
      processBatchSync(chatId);
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
        console.error('Error processing remaining messages during destroy:', error);
      } else {
        const wrappedError = new BatchAggregateError(
          [error instanceof Error ? error : new Error(String(error))],
          'Error processing remaining messages during destroy'
        );
        console.error('Error processing remaining messages during destroy:', wrappedError);
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
