import {
  type Message,
  type TelegramConfig,
  type MessageProcessor,
  NotificationLevel,
} from '../types';

const LEVEL_EMOJIS: Record<NotificationLevel, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨',
};

export class TelegramProcessor implements MessageProcessor {
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  public async processBatch(messages: Message[]): Promise<void> {
    if (this.config.development) {
      console.log('Development mode, not sending to Telegram:', messages);
      return;
    }

    if (!messages.length) return;

    const text = messages
      .map((msg) => `${LEVEL_EMOJIS[msg.level]} ${msg.text}`)
      .join('\n\n');

    const response = await fetch(
      `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message to Telegram: ${response.statusText}`);
    }
  }
}
