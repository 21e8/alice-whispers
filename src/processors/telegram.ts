import type { Message, MessageProcessor, TelegramConfig } from '../types';
import { classifyError } from '../utils/errorClassifier';
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

    const formattedMessages = messages
      .map((msg) => {
        const prefix = msg.level.toUpperCase();
        let text = `[${prefix}] ${msg.text}`;

        if (msg.level === 'error' && msg.error) {
          const classified = classifyError(msg.error);

          // Skip throttled errors
          if (classified.shouldThrottle) {
            if (classified.nextAllowedTimestamp) {
              const waitMinutes = Math.ceil(
                (classified.nextAllowedTimestamp - Date.now()) / 60000
              );
              text += `\n[THROTTLED] Similar errors suppressed for ${waitMinutes} minutes`;
            }
            return null;
          }

          text += `\nCategory: ${classified.category}`;
          text += `\nSeverity: ${classified.severity}`;
          if (classified.details) {
            text += `\nDetails: ${JSON.stringify(classified.details)}`;
          }
        }

        return text;
      })
      .filter(Boolean) // Remove null entries from throttled errors
      .join('\n');

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
  }

  return {
    processBatch,
  };
}
