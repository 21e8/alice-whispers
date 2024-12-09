import type {
  Message,
  MessageProcessor,
  TelegramConfig,
} from '../types';
import { EMOJI_MAP } from '../utils';

export function createTelegramProcessor(
  config: TelegramConfig
): MessageProcessor {
  return {
    name: 'telegram',
    processBatch: async (messages: Message[]) => {
      if (messages.length === 0) {
        console.log('[Telegram] No messages to send');
        return;
      }

      if (config.development) {
        console.log('[Telegram] Would send messages:', messages);
        return;
      }

      const formattedMessages = messages
        .map(([, text, level, error]) => {
          const emoji = EMOJI_MAP[level];
          const message = text.trim();
          if (!message) return null;
          return `${emoji} ${message}${error ? `\n${error}` : ''}`;
        })
        .filter(Boolean)
        .join('\n\n');

      if (!formattedMessages) {
        console.log('[Telegram] No messages to send');
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
          const error = await response.json();
          console.error('[Telegram] API Response:', error);
          throw new Error(
            `Failed to send Telegram message: ${response.status} ${response.statusText}\n${(error as any).description}`
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error('[Telegram] API Response:', {
            ok: false,
            error_code: 400,
            description: error.message,
          });
          throw error;
        }
        throw error;
      }
    },
  };
}
