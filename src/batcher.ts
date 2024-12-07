import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
  type MessageBatcher,
} from './types';

const globalQueues: Map<string, Message[]> = new Map();

export function createMessageBatcher(
  processors: MessageProcessor[],
  config: Required<BatcherConfig>
): MessageBatcher {
  const timers: Map<string, NodeJS.Timeout> = new Map();
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

  function error(message: string): void {
    queueMessage(message, 'error');
  }

  function queueMessage(message: string, level: NotificationLevel): void {
    const chatId = 'default';
    if (!globalQueues.has(chatId)) {
      globalQueues.set(chatId, []);
    }

    const queue = globalQueues.get(chatId) ?? [];
    queue.push({ chatId, text: message, level });

    if (queue.length >= config.maxBatchSize) {
      processBatch(chatId);
    }
  }

  async function processBatch(chatId: string): Promise<void> {
    const queue = globalQueues.get(chatId);
    if (!queue?.length) return;

    const batch = [...queue];
    globalQueues.set(chatId, []);

    const results = await Promise.allSettled(
      processors.map((processor) => processor.processBatch(batch))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Processor ${index} failed:`, result.reason);
      }
    });
  }

  async function flush(): Promise<void> {
    for (const chatId of globalQueues.keys()) {
      await processBatch(chatId);
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
    flush,
    destroy,
  };
}

// Reset function now only clears the queue
export function resetBatcher(): void {
  globalQueues.clear();
}
