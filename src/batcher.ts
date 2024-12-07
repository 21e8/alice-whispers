import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
} from './types';
import { TelegramBatcher } from './telegram';

export class MessageBatcher {
  private queues: Map<string, Message[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private processInterval: NodeJS.Timeout | null = null;
  private telegram: TelegramBatcher;
  protected config: BatcherConfig;

  constructor(telegram: TelegramBatcher, config: BatcherConfig) {
    this.telegram = telegram;
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

  protected queueMessage(message: string, level: NotificationLevel): void {
    this.addMessage({
      chatId: 'default',
      text: message,
      level,
    });
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
    }
  }

  private async processBatch(chatId: string): Promise<void> {
    const queue = this.queues.get(chatId);
    if (!queue?.length) return;

    const batch = [...queue];
    this.queues.set(chatId, []);

    await this.telegram.processBatch(batch);
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
