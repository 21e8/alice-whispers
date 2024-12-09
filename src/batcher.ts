import type {
  BatcherConfig,
  Message,
  MessageBatcher,
  MessageProcessor,
  NotificationLevel,
} from './types';
import Queue from './utils/queue';

const globalBatchers = new Map<string, MessageBatcher>();

export function createMessageBatcher(config: BatcherConfig): MessageBatcher {
  const id = config.id ?? 'default';
  const isSingleton = config.singleton ?? true;
  const existingBatcher = globalBatchers.get(id);
  if (globalBatchers.size > 0) {
    console.warn(
      'You are trying to create a new batcher while there is already one. This is currently not supported. Be at your own risk.'
    );
  }
  if (isSingleton && existingBatcher) {
    return existingBatcher;
  }

  let processInterval: NodeJS.Timeout | null = null;
  const queues: Map<string, Queue<Message>> = new Map();
  const timers: Map<string, NodeJS.Timeout> = new Map();
  const processors: MessageProcessor[] = [];
  const processorNames = new Set<string>();
  const concurrentProcessors = config.concurrentProcessors ?? 3;
  const maxBatchSize = config.maxBatchSize ?? 100;
  const maxWaitMs = config.maxWaitMs ?? 60_000; // 1 minute

  for (const processor of config.processors ?? []) {
    addProcessor(processor);
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

  function addProcessor(processor: MessageProcessor): void {
    if (processorNames.has(processor.name)) {
      console.error(`Processor ${processor.name} already exists`);
      return;
    }
    processors.push(processor);
    processorNames.add(processor.name);
  }

  function removeProcessor(name: string): void {
    if (!processorNames.has(name)) {
      console.error(`Processor ${name} not found`);
      return;
    }
    const index = processors.findIndex(p => p.name === name);
    if (index !== -1) {
      processors.splice(index, 1);
    }
    processorNames.delete(name);
  }

  function removeAllProcessors(): void {
    processors.length = 0;
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
    let queue = queues.get(chatId);
    if (!queue) {
      queue = new Queue<Message>();
      queues.set(chatId, queue);
    }

    queue.enqueue([chatId, message, level, error]);

    if (queue.size >= maxBatchSize) {
      const timer = timers.get(chatId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(chatId);
      }
      processBatch(chatId);
    } else {
      const timer = timers.get(chatId);
      if (!timer) {
        timers.set(
          chatId,
          setTimeout(() => processBatch(chatId), maxWaitMs)
        );
      }
    }
  }

  async function processBatch(chatId: string): Promise<void> {
    const queue = queues.get(chatId);
    if (!queue || queue.size === 0) return;

    const timer = timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(chatId);
    }

    const messages = queue.toArray();
    queues.delete(chatId);

    // Process in parallel with concurrency limit
    const chunks = [];
    for (let i = 0; i < messages.length; i += concurrentProcessors) {
      chunks.push(messages.slice(i, i + concurrentProcessors));
    }

    for (const chunk of chunks) {
      await Promise.all(
        processors.map(processor => processor.processBatch(chunk))
      );
    }
  }

  async function flush(): Promise<void> {
    const chatIds = Array.from(queues.keys());
    await Promise.all(chatIds.map(chatId => processBatch(chatId)));
  }

  function flushSync(): void {
    const chatIds = Array.from(queues.keys());
    for (const chatId of chatIds) {
      const queue = queues.get(chatId);
      if (!queue || queue.size === 0) continue;

      const timer = timers.get(chatId);
      if (timer) {
        clearTimeout(timer);
        timers.delete(chatId);
      }

      const messages = queue.toArray();
      queues.delete(chatId);

      for (const processor of processors) {
        processor.processBatch(messages);
      }
    }
  }

  async function destroy(): Promise<void> {
    if (processInterval) {
      clearInterval(processInterval);
      processInterval = null;
    }

    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    await flush();
    removeAllProcessors();
    queues.clear();
    globalBatchers.delete(id);
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

  globalBatchers.set(id, batcher);
  return batcher;
}
