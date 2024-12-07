import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
} from './types';

export class MessageBatcher {
  private queues: Map<string, Message[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private processInterval: NodeJS.Timeout | null = null;
  private processors: MessageProcessor[];
  protected config: BatcherConfig;

  constructor(processors: MessageProcessor[], config: BatcherConfig) {
    this.processors = processors;
    this.config = config;
    this.startProcessing();
  }

  private startProcessing(): void {
    this.processInterval = setInterval(() => {
      for (const chatId of this.queues.keys()) {
        this.processBatch(chatId);
      }
    }, this.config.maxWaitMs);
  }

  public info(message: string): void {
    this.queueMessage(message, 'info');
  }

  public warning(message: string): void {
    this.queueMessage(message, 'warning');
  }

  public error(message: string): void {
    this.queueMessage(message, 'error');
  }

  public queueMessage(message: string, level: NotificationLevel): void {
    const chatId = 'default';
    if (!this.queues.has(chatId)) {
      this.queues.set(chatId, []);
    }

    const queue = this.queues.get(chatId) ?? [];
    queue.push({ chatId, text: message, level });

    if (queue.length >= this.config.maxBatchSize) {
      this.processBatch(chatId);
    }
  }

  private async processBatch(chatId: string): Promise<void> {
    const queue = this.queues.get(chatId);
    if (!queue?.length) return;

    const batch = [...queue];
    this.queues.set(chatId, []);

    await Promise.all(
      this.processors.map((processor) => processor.processBatch(batch))
    );
  }

  public destroy(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queues.clear();
  }
}
