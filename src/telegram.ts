import { MessageBatcher } from './batcher';
import type { NotificationLevel, TelegramConfig, Message } from './types';

const LEVEL_EMOJIS: Record<NotificationLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨'
};

export class TelegramBatcher {
  private batcher: MessageBatcher;
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
    this.batcher = new MessageBatcher({
      maxBatchSize: 10,
      maxWaitMs: config.batchDelay ?? 60000,
      processBatch: this.sendToTelegram.bind(this)
    });
  }

  private async sendToTelegram(messages: Message[]): Promise<void> {
    if (this.config.development) {
      console.log('Development mode, not sending to Telegram:', messages);
      return;
    }

    const text = messages.map(m => m.text).join('\n\n');
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Failed to send Telegram message:', error);
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
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

  private queueMessage(message: string, level: NotificationLevel): void {
    const emoji = LEVEL_EMOJIS[level];
    this.batcher.addMessage({
      chatId: this.config.chatId,
      text: `${emoji} ${message}`
    });
  }

  public destroy(): void {
    this.batcher.destroy();
  }
} 