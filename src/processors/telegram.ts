import type { Message, MessageProcessor, TelegramConfig } from '../types';
// import fetch from 'node-fetch';

export function createTelegramProcessor(config: TelegramConfig): MessageProcessor {
  const { botToken, chatId, development = false } = config;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  async function processBatch(messages: Message[]): Promise<void> {
    if (development) {
      console.log('[Telegram] Would send messages:', messages);
      return;
    }
    
    if (!messages.length) {
      return;
    }

    const text = messages
      .map((msg) => `[${msg.level.toUpperCase()}] ${msg.text}`)
      .join('\n');

    const response = await fetch(`${baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
  }

  return {
    processBatch,
  };
}
