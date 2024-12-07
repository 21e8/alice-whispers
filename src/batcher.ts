import { type Message, type BatcherConfig } from './types';

export class MessageBatcher {
  private queues: Map<string, Message[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  protected config: BatcherConfig;

  constructor(config: BatcherConfig) {
    this.config = config;
  }

  public addMessage(message: Message): void {
    const { chatId } = message;
    if (!this.queues.has(chatId)) {
      this.queues.set(chatId, []);
    }

    const queue = this.queues.get(chatId) ?? [];
    queue.push(message);

    if (queue.length >= this.config.maxBatchSize) {
      this.processBatch(chatId);
    } else if (!this.timers.has(chatId)) {
      const timer = setTimeout(() => {
        this.processBatch(chatId);
      }, this.config.maxWaitMs);
      this.timers.set(chatId, timer);
    }
  }

  private processBatch(chatId: string): void {
    const queue = this.queues.get(chatId);
    if (!queue?.length) return;

    const timer = this.timers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(chatId);
    }

    const batch = [...queue];
    this.queues.set(chatId, []);
    
    void this.config.processBatch(batch);
  }

  public destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queues.clear();
  }
}
