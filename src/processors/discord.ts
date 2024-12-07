import { Message, MessageProcessor } from '../types';
// import fetch from 'node-fetch';

export type DiscordConfig = {
  webhookUrl: string;
  username?: string;
};

export class DiscordProcessor implements MessageProcessor {
  private config: DiscordConfig;

  constructor(config: DiscordConfig) {
    this.config = config;
  }

  async processBatch(messages: Message[]): Promise<void> {
    const content = messages.map(msg => 
      `${this.getLevelEmoji(msg.level)} ${msg.text}`
    ).join('\n\n');

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username: this.config.username
      })
    });
  }

  private getLevelEmoji(level: string): string {
    const emojis = {
      info: '�',
      warning: '⚠️',
      error: '🚨'
    };
    return emojis[level as keyof typeof emojis] || '';
  }
} 