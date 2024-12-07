import { Message, MessageProcessor } from '../types';
// import fetch from 'node-fetch';

export type DiscordConfig = {
  webhookUrl: string;
  username?: string;
};

export function createDiscordProcessor(config: DiscordConfig): MessageProcessor {
  function getLevelEmoji(level: string): string {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '🚨'
    };
    return emojis[level as keyof typeof emojis] || '';
  }

  async function processBatch(messages: Message[]): Promise<void> {
    const content = messages.map(msg => 
      `${getLevelEmoji(msg.level)} ${msg.text}`
    ).join('\n\n');

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username: config.username
      })
    });
  }

  return { processBatch };
} 