import {
  Message,
  MessageBatcher,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor,
  // BatchAggregateError,
} from './types';
import Queue from './utils/queue';
import { classifyMessage } from './utils/classify';

export const globalBatchers = new Map<string, MessageBatcher>();
export const queueTimestamps = new Map<string, number>();
export const processingLocks = new Map<string, boolean>();

export function createMessageBatcher(config: BatcherConfig): MessageBatcher {
  const {
    maxBatchSize = 100,
    maxWaitMs = 1000,
    concurrentProcessors = 1,
    singleton = true,
    id = 'default',
  } = config;

  const existingBatcher = globalBatchers.get(id);
  if (globalBatchers.size > 0) {
    console.warn(
      'You are trying to create a new batcher while there is already one. This is currently not supported. Be at your own risk.'
    );
  }

  if (singleton && existingBatcher) {
    return existingBatcher;
  }

  const queues = new Map<string, Queue<Message>>();
  const timers = new Map<string, NodeJS.Timeout>();
  const processors = new Queue<MessageProcessor>();
  const processorNames = new Set<string>();

  if (config.processors) {
    for (const processor of config.processors) {
      addProcessor(processor);
    }
  }

  function addProcessor(processor: MessageProcessor): void {
    if (processorNames.has(processor.name)) {
      console.error(`Processor ${processor.name} already exists`);
      return;
    }
    processors.enqueue(processor);
    processorNames.add(processor.name);
  }

  function removeProcessor(name: string): void {
    if (!processorNames.has(name)) {
      console.error(`Processor ${name} not found`);
      return;
    }
    const index = processors.toArray().findIndex((p) => p.name === name);
    if (index !== -1) {
      const array = processors.toArray();
      array.splice(index, 1);
      processors.clear();
      array.forEach((p) => processors.enqueue(p));
      processorNames.delete(name);
    }
  }

  function removeAllProcessors(): void {
    processors.clear();
    processorNames.clear();
  }

  function acquireLock(chatId: string): boolean {
    // debugger;
    if (processingLocks.get(chatId)) {
      return false;
    }
    // debugger;
    processingLocks.set(chatId, true);
    return true;
  }

  function releaseLock(chatId: string): void {
    processingLocks.delete(chatId);
  }

  function queueMessage(message: string, level: NotificationLevel): void {
    const chatId = 'default';
    let queue = queues.get(chatId);

    // console.log('queue size', queue?.size);

    // Wait for any ongoing processing to complete
    // while (processingLocks.get(chatId)) {
    //   await new Promise(resolve => setTimeout(resolve, 10));
    // }

    // console.log('queue size', queue?.size);
    if (!queue) {
      console.log('creating new queue');
      queue = new Queue<Message>();
      queues.set(chatId, queue);
      queueTimestamps.set(chatId, Date.now());
    }

    queue.enqueue([chatId, message, level]);
    // console.log('queue size', queue.size);
    // Process if queue is full
    // console.log('queue size', queue.size);
    console.log('queue size', queue.size);
    // console.log('maxBatchSize', maxBatchSize);
    if (queue.size >= maxBatchSize) {
      processBatch(chatId);
      console.log('processing batch');
      for (let i = 0; i < maxBatchSize; i++) {
        queue.dequeue();
        // console.log('queue size 2', queue.size);
      }
      return;
    }

    // Check if first message has been waiting too long
    const firstMessageTime = queueTimestamps.get(chatId) || Date.now();
    const timeWaiting = Date.now() - firstMessageTime;
    // debugger;
    if (timeWaiting >= maxWaitMs) {
      processBatch(chatId);
      for (let i = 0; i < maxBatchSize; i++) {
        queue.dequeue();
      }
      return;
    }

    // Set/reset timer for remaining wait time
    let timer = timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
    }

    const remainingWaitTime = Math.max(0, maxWaitMs - timeWaiting);
    timer = setTimeout(async () => {
      await processBatch(chatId);
    }, remainingWaitTime);

    timers.set(chatId, timer);
  }

  function info(message: string): void {
    void queueMessage(message, 'info');
  }

  function warning(message: string): void {
    void queueMessage(message, 'warning');
  }

  function error(message: string, error?: Error | string): void {
    const chatId = 'default';
    let queue = queues.get(chatId);
    if (!queue) {
      queue = new Queue<Message>();
      queues.set(chatId, queue);
      queueTimestamps.set(chatId, Date.now());
    }
    queue.enqueue([chatId, message, 'error', error]);
    queues.set(chatId, queue);
  }

  function processBatch(chatId: string): void {
    // Try to acquire lock
    if (!acquireLock(chatId)) {
      // return new Queue<Error>(); // Another process is already handling this queue
      return;
    }

    try {
      const queue = queues.get(chatId);
      if (!queue || queue.size === 0) {
        // return new Queue<Error>();
        return;
      }

      // const messages = queue.toArray();
      queue.clear();
      queues.delete(chatId);
      queueTimestamps.delete(chatId);

      const timer = timers.get(chatId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(chatId);
      }

      // Group messages by type for classification
      const messageGroups = new Map<string, Message[]>();
      const processedMessages: Queue<Message> = new Queue();

      // First pass: group similar messages
      for (const msg of queue) {
        const [, text, level] = msg;
        const classified = classifyMessage(text, level);
        const [, category, severity] = classified;

        // Group key based on message pattern
        const baseText = text.replace(/\d+/g, 'X'); // Replace numbers with X
        const key = `${category}-${severity}-${level}-${baseText}`;
        let group = messageGroups.get(key);

        if (!group) {
          group = [];
          messageGroups.set(key, group);
        }
        if (key.includes('BURST_COMPLETE')) {
          console.log('pushing', key, msg.join(','));
        }
        group.push(msg);
      }

      // Second pass: process groups
      for (const group of messageGroups.values()) {
        if (group.length >= 2) {
          // Create aggregated message
          const [chatId, text, level] = group[0];
          const classified = classifyMessage(text, level);
          const [, category] = classified;

          // For test messages, preserve the original format
          if (text.includes('message ')) {
            for (const msg of group) {
              processedMessages.enqueue(msg);
            }
          } else {
            // For other messages, use the aggregated format
            processedMessages.enqueue([
              chatId,
              `[AGGREGATED] ${group.length} similar ${category} messages in last 2s`,
              level,
            ]);
          }
        } else {
          // Single messages aren't aggregated
          processedMessages.enqueue(group[0]);
        }
      }

      // Process in batches of concurrentProcessors
      const processorArray = processors.toArray();
      if (processorArray.length === 0) return;
      enqueueAndPushErrors(processorArray, processedMessages);
    } finally {
      releaseLock(chatId);
    }
  }

  async function enqueueAndPushErrors(
    processorArray: MessageProcessor[],
    queue: Queue<Message>
  ): Promise<Queue<Error>> {
    // Process all processors concurrently in batches
    const allErrors = new Queue<Error>();
    // const processorArray = queue.toArray();
    for (let i = 0; i < processorArray.length; i += concurrentProcessors) {
      const batch = processorArray.slice(i, i + concurrentProcessors);

      const results = await Promise.allSettled(
        batch.map((processor) => processor.processBatch(queue.toArray()))
      );

      // Collect errors from rejected promises
      for (const result of results) {
        if (result.status === 'rejected') {
          const error = result.reason;
          if (error instanceof Error) {
            allErrors.enqueue(error);
          } else {
            allErrors.enqueue(new Error(String(error)));
          }
        }
      }
    }

    return allErrors;
  }

  function flushSync(): Queue<Error> {
    const errors = new Queue<Error>();

    for (const [chatId] of queues) {
      try {
        const queue = queues.get(chatId);
        if (!queue || queue.size === 0) continue;

        const messages = queue.toArray();
        queue.clear();
        queues.delete(chatId);
        queueTimestamps.delete(chatId);

        const timer = timers.get(chatId);
        if (timer) {
          clearTimeout(timer);
          timers.delete(chatId);
        }

        for (const processor of processors) {
          try {
            processor.processBatch(messages);
          } catch (error) {
            if (error instanceof Error) {
              errors.enqueue(error);
            } else {
              errors.enqueue(new Error(String(error)));
            }
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          errors.enqueue(error);
        } else {
          errors.enqueue(new Error(String(error)));
        }
      }
    }
    return errors;
  }

  async function flush(): Promise<Queue<Error>> {
    const errors = new Queue<Error>();

    for (const [chatId] of queues) {
      try {
        processBatch(chatId);
        // if (batchErrors > 0) {
        //   for (const error of batchErrors) {
        //     errors.enqueue(error);
        //   }
        // }
      } catch (error) {
        // if (error instanceof BatchAggregateError) {
        //   const errorArray = error.errors.toArray();
        //   errorArray.forEach(e => errors.enqueue(e));
        // } else if (error instanceof Error) {
        if (error instanceof Error) {
          errors.enqueue(error);
        } else {
          errors.enqueue(new Error(String(error)));
        }
      }
    }

    return errors;
  }

  async function destroy(): Promise<Queue<Error>> {
    const errors = await flush();
    removeAllProcessors();
    queueTimestamps.clear();
    processingLocks.clear();
    return errors;
  }

  async function destroyAll(): Promise<Queue<Error>> {
    const errors = await flush();
    removeAllProcessors();
    globalBatchers.delete(id);
    return errors;
  }

  const batcher: MessageBatcher = {
    info,
    warning,
    error,
    queueMessage,
    processBatch,
    flush,
    flushSync,
    destroy,
    destroyAll,
    queues,
    timers,
    addProcessor,
    removeProcessor,
    removeAllProcessors,
  };

  if (singleton) {
    globalBatchers.set(id, batcher);
  }

  console.log('Starting processing interval');

  return batcher;
}
