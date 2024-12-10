import type { Message, MessageProcessor, TelegramConfig } from '../types';
import { EMOJI_MAP } from '../utils';
import { shouldLog, normalizeLogLevel } from '../utils/logging';
import Queue from '../utils/queue';

const sendTelegramMessage = async (
  messages: string,
  config: TelegramConfig
) => {
  const response = await fetch(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: messages,
        parse_mode: 'HTML',
      }),
    }
  );
  return response;
};

const handleQueue = (messages: Queue<Message>, config: TelegramConfig) => {
  if (messages.size === 0) {
    console.debug('[Telegram] No messages to send');
    return;
  }

  if (config.development) {
    console.debug('[Telegram] Would send messages:', messages);
    return;
  }
  const formattedMessages: string[] = [];
  for (const msg of messages) {
    const [, text, level, error] = msg;
    if (!shouldLog(level, config.logLevel)) continue;

    const emoji = EMOJI_MAP[level];
    const message = text.trim();
    if (!message) continue;
    formattedMessages.push(`${emoji} ${message}${error ? `\n${error}` : ''}`);
  }
  const filteredMessages = formattedMessages.filter(Boolean);
  if (filteredMessages.length === 0) {
    console.debug('[Telegram] No messages to send');
    return;
  }

  const filteredMessagesString = filteredMessages.join('\n\n');

  try {
    sendTelegramMessage(filteredMessagesString, config);
  } catch (error) {
    console.error('[Telegram] API Response:', error);
  }
};

const handleMessages = (messages: Message[], config: TelegramConfig) => {
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
    sendTelegramMessage(formattedMessages, config);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error(
      '[Telegram] API Response: ',
      error.statusText || error.message || error.description || error
    );
    throw error;
  }
};

export function createTelegramProcessor(
  config: TelegramConfig
): MessageProcessor {
  return {
    name: 'telegram',
    logLevel: normalizeLogLevel(config.logLevel),
    processBatch: async (messages: Message[] | Queue<Message>) => {
      if (messages instanceof Queue) {
        handleQueue(messages, config);
        return;
      }

      if (messages.length === 0) {
        console.debug('[Telegram] No messages to send');
        return;
      }

      if (config.development) {
        console.debug('[Telegram] Would send messages:', messages);
        return;
      }

      await handleMessages(messages, config);
    },
  };
}
