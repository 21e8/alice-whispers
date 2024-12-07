import { Message, MessageProcessor } from '../types';
// import fetch from 'node-fetch';  // Uncomment this

export type SlackConfig = {
  webhookUrl: string;
  channel: string;
  username?: string;
};

export function createSlackProcessor(config: SlackConfig): MessageProcessor {
  function getLevelEmoji(level: string): string {
    const emojis = {
      info: ':information_source:',
      warning: ':warning:',
      error: ':rotating_light:'
    };
    return emojis[level as keyof typeof emojis] || '';
  }

  async function processBatch(messages: Message[]): Promise<void> {
    if (!messages.length) {
      return;
    }

    const blocks = messages.map(msg => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${getLevelEmoji(msg.level)} ${msg.text}`
      }
    }));

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: config.channel,
        username: config.username,
        blocks
      })
    });
  }

  return { processBatch };
}