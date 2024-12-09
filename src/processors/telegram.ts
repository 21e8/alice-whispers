import type { Message, MessageProcessor, TelegramConfig } from '../types';
import { EMOJI_MAP } from '../utils';
import { shouldLog, normalizeLogLevel } from '../utils/logging';

export function createTelegramProcessor(
  config: TelegramConfig
): MessageProcessor {
  return {
    name: 'telegram',
    logLevel: normalizeLogLevel(config.logLevel),
    processBatch: async (messages: Message[]) => {
      if (messages.length === 0) {
        console.debug('[Telegram] No messages to send');
        return;
      }

      if (config.development) {
        console.debug('[Telegram] Would send messages:', messages);
        return;
      }

      const formattedMessages = messages
        .map(([, text, level, error]) => {
          if (!shouldLog(level, config.logLevel)) return null;

          const emoji = EMOJI_MAP[level];
          const message = text.trim();
          if (!message) return null;
          return `${emoji} ${message}${error ? `\n${error}` : ''}`;
        })
        .filter(Boolean)
        .join('\n\n');

      if (!formattedMessages) {
        console.debug('[Telegram] No messages to send');
        return;
      }

      try {
        const response = await fetch(
          `https://api.telegram.org/bot${config.botToken}/sendMessage`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: config.chatId,
              text: formattedMessages,
              parse_mode: 'HTML',
            }),
          }
        );
        if (!response.ok) {
          // const error = await response.json();
          console.error('[Telegram] API Response:', response.statusText);
          throw new Error(
            `Failed to send Telegram message: ${response.status} ${response.statusText}`
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {

        console.error(
          '[Telegram] API Response: ',
          error.statusText || error.message || error.description || error
        );
        throw error;
      }
    },
  };
}
