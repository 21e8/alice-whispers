import type { Message, MessageProcessor, TelegramConfig } from '../types';
import {
  classifyError,
  clearErrorTracking,
  formatClassifiedError,
} from '../utils/errorClassifier';
// import fetch from 'node-fetch';

export function createTelegramProcessor(
  config: TelegramConfig
): MessageProcessor {
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

    try {
      const formattedMessages = messages
        .map((msg) => {
          const prefix = msg.level.toUpperCase();
          let text = `[${prefix}] ${msg.text}`;

          if (msg.level === 'error' && msg.error) {
            const classified = classifyError(msg.error);
            text += '\n' + formatClassifiedError(classified);
            return text;
          }

          return text;
        })
        .filter(Boolean)
        .join('\n');

      if (!formattedMessages.length) {
        console.log('[Telegram] No messages to send');
        return;
      }

      const response = await fetch(`${baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formattedMessages,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.statusText}`);
      }
    } finally {
      // Clear error tracking after processing batch
      clearErrorTracking();
    }
  }

  return {
    processBatch,
  };
}
