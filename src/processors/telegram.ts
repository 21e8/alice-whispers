import type {
  InternalMessageProcessor,
  Message,
  NotificationLevel,
  TelegramConfig,
} from '../types';
import {
  classifyError,
  clearErrorTracking,
  formatClassifiedError,
} from '../utils/errorClassifier';

const EMOJIS = new Map<NotificationLevel | string, string>([
  ['error', '🚨'],
  ['warning', '⚠️'],
  ['info', 'ℹ️'],
]);

type TelegramApiError = {
  ok: boolean;
  error_code: number;
  description: string;
};

export function createTelegramProcessor(
  config: TelegramConfig
): InternalMessageProcessor {
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
      const texts = await Promise.all(
        messages.map(async (msg) => {
          const [, text, level, error] = msg;
          if (!text.trim()) return null;
          const prefix = level.toUpperCase();
          let message = `${EMOJIS.get(level)} [${prefix}] ${text}`;

          if (level === 'error' && error) {
            const classified = await classifyError(error);
            message += '\n' + formatClassifiedError(classified);
          }

          return message;
        })
      );

      const formattedMessages = texts.filter(Boolean).join('\n');
      if (!formattedMessages) {
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
        const data = await response.json();
        console.error('[Telegram] API Response:', data);
        const errorData = data as TelegramApiError;
        throw new Error(
          `Telegram API error: ${response.statusText || 'Unknown Error'} - ${
            errorData.description || JSON.stringify(data)
          }`
        );
      }
    } catch (error) {
      console.error('[Telegram] Error sending message:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
    } finally {
      clearErrorTracking();
    }
  }

  return {
    processBatch,
    name: 'telegram',
    type: 'internal',
  };
}
