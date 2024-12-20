import type {
  Message,
  MessageProcessor,
  TelegramConfig,
  TelegramConfigArray,
} from '../types';
import { EMOJI_MAP } from '../utils';
import { shouldLog, normalizeLogLevel } from '../utils/logging';
import Queue from '../utils/queue';

const sendTelegramMessage = async (
  messages: string,
  config: TelegramConfigArray
) => {
  const response = await fetch(
    `https://api.telegram.org/bot${config[0]}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config[1],
        text: messages,
        parse_mode: 'HTML',
      }),
    }
  );
  return response;
};

const handleQueue = (messages: Queue<Message>, config: TelegramConfigArray) => {
  if (messages.size === 0) {
    console.debug('[Telegram] No messages to send');
    return;
  }

  if (config[3]) {
    console.debug('[Telegram] Would send messages:', messages);
    return;
  }
  const formattedMessages: string[] = [];
  for (const msg of messages) {
    const [, text, level, error] = msg;
    if (!shouldLog(level, config[4])) continue;

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
    sendTelegramMessage(filteredMessagesString, config).catch((error) => {
      console.error('[Telegram] API Response:', error);
    });
  } catch (error) {
    console.error('[Telegram] API Response:', error);
  }
};

const handleMessages = (messages: Message[], config: TelegramConfigArray) => {
  const formattedMessages = messages
    .map(([, text, level, error]) => {
      if (!shouldLog(level, config[4])) return null;

      const emoji = EMOJI_MAP[level] || '';
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
    name: `telegram-${new Date().toISOString()}`,
    logLevel: normalizeLogLevel(config.logLevel),
    processBatch: (messages: Message[] | Queue<Message>) => {
      if (messages instanceof Queue) {
        handleQueue(messages, [
          config.chatId,
          config.botToken,
          undefined,
          config.development,
        ]);
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

      handleMessages(messages, [
        config.botToken,
        config.chatId,
        undefined,
        config.development,
        config.logLevel,
      ]);
    },
  };
}
