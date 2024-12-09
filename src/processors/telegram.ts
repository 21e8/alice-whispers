import type {
  Message,
  MessageProcessor,
  NotificationLevel,
  TelegramConfig,
} from '../types';

const LEVEL_EMOJIS = new Map<NotificationLevel | string, string>([
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
): MessageProcessor {
  const { botToken, chatId, development = false } = config;

  return {
    name: 'telegram',
    processBatch: async (messages: Message[]) => {
      if (development) {
        console.log('Development mode: skipping Telegram message');
        return;
      }

      const formattedMessages = messages.map(([_, text, level, error]) => {
        const emoji = LEVEL_EMOJIS.get(level);
        return `${emoji} ${text}${error ? `\n${error}` : ''}`;
      });

      const text = formattedMessages.join('\n\n');

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to send Telegram message: ${response.status} ${
            response.statusText
          }\n${await (response && response.text && response.text())}`
        );
      }
    },
  };
}
