import type {
  NotificationLevel,
  TelegramConfig,
  Message,
  MessageProcessor,
} from './types';
import fetch from 'node-fetch';

const LEVEL_EMOJIS: Record<NotificationLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨',
};

export class TelegramBatcher implements MessageProcessor {
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  public async processBatch(messages: Message[]): Promise<void> {
    if (this.config.development) {
      console.log('Development mode, not sending to Telegram:', messages);
      return;
    }

    const formattedMessages = messages.map((msg) => {
      const emoji = LEVEL_EMOJIS[msg.level];
      return `${emoji} ${msg.text}`;
    });

    const text = formattedMessages.join('\n\n');
    await this.sendMessage(text);
  }

  private async sendMessage(text: string): Promise<void> {
    if (this.config.development) {
      console.log('[Telegram]', text);
      return;
    }

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.config.chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to send message to Telegram: ${response.statusText}`
      );
    }
  }
}
