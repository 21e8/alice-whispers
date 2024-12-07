import { Message, MessageProcessor } from '../types';
import fetch from 'node-fetch';

type SlackConfig = {
  webhookUrl: string;
  channel: string;
  username?: string;
};

export class SlackProcessor implements MessageProcessor {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  async processBatch(messages: Message[]): Promise<void> {
    const blocks = messages.map(msg => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${this.getLevelEmoji(msg.level)} ${msg.text}`
      }
    }));

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: this.config.channel,
        username: this.config.username,
        blocks
      })
    });
  }

  private getLevelEmoji(level: string): string {
    const emojis = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':rotating_light:'
    };
    return emojis[level as keyof typeof emojis] || '';
  }
} 