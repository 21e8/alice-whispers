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
  getAggregatedErrors,
} from '../utils/errorClassifier';
import Queue from '../utils/queue';

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

  async function processBatch(messages: Queue<Message>): Promise<void> {
    if (!messages.size) {
      return;
    }

    try {
      // First pass: Classify all messages to populate aggregation tracking
      const classifiedMessages = await Promise.all(
        messages.toArray().map(async (msg) => {
          if (msg[2] === 'error' && msg[3]) {
            return classifyError(msg[3], msg[2]);
          } else {
            return classifyError(msg[1], msg[2]);
          }
        })
      );

      // Get aggregated message stats
      const aggregatedMessages = getAggregatedErrors();
      const processedMessages = new Set<string>();

      // Second pass: Format messages with aggregation
      const texts = await Promise.all(
        messages.toArray().map(async (msg, index) => {
          if (!msg[1].trim()) return null;

          const classified = classifiedMessages[index]!;
          const key = `${classified[1]}-${classified[2]}-${msg[2]}`;

          // If this message is part of an aggregation and we haven't processed it yet
          if (aggregatedMessages[key] && !processedMessages.has(key)) {
            processedMessages.add(key);
            return `${EMOJIS.get(msg[2]) ?? ''} ${formatClassifiedError(classified)}`;
          } else if (!aggregatedMessages[key]) {
            // Not aggregated, show full message
            const prefix = msg[2].toUpperCase();
            return `${EMOJIS.get(msg[2]) ?? ''} [${prefix}] ${msg[1]}`;
          }
          return null; // Skip aggregated messages after the first one
        })
      );

      const formattedMessages = texts.filter(Boolean).join('\n');
      if (!formattedMessages) {
        console.log('[Telegram] No messages to send');
        return;
      }

      if (development) {
        console.log('[Telegram] Would send messages:\n' + formattedMessages);
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
