import type {
  Message,
  MessageProcessor,
  TelegramConfig,
  TelegramConfigArray,
} from '../types';
import { EMOJI_MAP } from '../utils';
import { shouldLog, normalizeLogLevel } from '../utils/logging';
import Queue from '../utils/queue';

interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
    };
    message: {
      chat: {
        id: number;
      };
      message_id: number;
    };
    data: string;
  };
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
}

// const baseUrl = 'https://api.telegram.org/bot';

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

function createTelegramBot({
  token,
  chatId,
}: {
  token: string;
  chatId: number;
}) {
  const baseUrl = `https://api.telegram.org/bot${token}`;
  let isRunning = false;

  async function makeRequest(
    endpoint: string,
    method = 'GET',
    body?: object
  ): Promise<Record<string, unknown>> {
    const isLongPolling =
      endpoint === 'getUpdates' &&
      body &&
      typeof body === 'object' &&
      'timeout' in body &&
      typeof body.timeout === 'number' &&
      body.timeout > 0;
    const controller = new AbortController();

    // Only set timeout for non-long-polling requests
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (!isLongPolling) {
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    }

    try {
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body:
          method === 'GET'
            ? undefined
            : body
            ? JSON.stringify(body)
            : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Telegram API error: ${response.status} ${response.statusText} ${text}`
        );
      }

      const json = await response.json();
      return json as Record<string, unknown>;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function sendDeletableMessage(text: string): Promise<void> {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🗑️ Delete Message', callback_data: 'delete' }],
      ],
    };

    await makeRequest('sendMessage', 'POST', {
      chat_id: chatId,
      text,
      reply_markup: keyboard,
    });
  }

  async function handleCallback(
    callbackQuery: TelegramUpdate['callback_query']
  ): Promise<void> {
    if (!callbackQuery) return;

    const { id, data, message } = callbackQuery;
    const chatId = message.chat.id;
    const messageId = message.message_id;

    try {
      // Handle different button clicks first
      switch (data) {
        case 'delete':
          await makeRequest('deleteMessage', 'POST', {
            chat_id: chatId,
            message_id: messageId,
          });
          break;
        default:
          console.log(`Unknown callback data: ${data}`);
      }

      // Answer the callback query after performing the action
      await makeRequest('answerCallbackQuery', 'POST', {
        callback_query_id: id,
      });
    } catch (error) {
      console.error('Error handling callback:', error);

      // Try to answer the callback query even if the action failed
      try {
        await makeRequest('answerCallbackQuery', 'POST', {
          callback_query_id: id,
          text: 'Error processing request',
          show_alert: true,
        });
      } catch (answerError) {
        console.error('Error answering callback query:', answerError);
      }
    }
  }

  async function startPolling(): Promise<void> {
    if (isRunning) {
      console.warn('Polling is already running');
      return;
    }

    isRunning = true;
    let offset = 0;
    const POLLING_TIMEOUT = 30;
    const ERROR_RETRY_DELAY = 5000;
    const MAX_RETRIES = 3;

    while (isRunning) {
      try {
        // Get updates with long polling
        const data = await makeRequest('getUpdates', 'POST', {
          offset,
          timeout: POLLING_TIMEOUT,
          allowed_updates: ['callback_query', 'message'], // Only get updates we handle
        });

        if (!data || !data.result) {
          console.warn('Invalid response from Telegram API:', data);
          continue;
        }

        const updates: TelegramUpdate[] = data.result as TelegramUpdate[];

        // Process updates
        for (const update of updates) {
          // Update offset to acknowledge this update
          offset = update.update_id + 1;

          try {
            if (update.callback_query) {
              await handleCallback(update.callback_query);
            }
            // Add other update type handlers here if needed
          } catch (updateError) {
            console.error('Error processing update:', updateError);
            // Continue with next update even if one fails
            continue;
          }
        }
      } catch (error) {
        console.error('Polling error:', error);

        // Implement exponential backoff
        let retryCount = 0;
        while (retryCount < MAX_RETRIES) {
          const delay = ERROR_RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));

          try {
            // Try to get updates again
            const data = await makeRequest('getUpdates', 'POST', {
              offset,
              timeout: POLLING_TIMEOUT,
            });
            if (data && data.result) {
              console.log('Successfully reconnected to Telegram API');
              break;
            }
          } catch (retryError) {
            console.error(`Retry ${retryCount + 1} failed:`, retryError);
          }
          retryCount++;
        }

        if (retryCount === MAX_RETRIES) {
          console.error(
            'Max retries reached. Polling will continue with normal delay.'
          );
          await new Promise((resolve) =>
            setTimeout(resolve, ERROR_RETRY_DELAY)
          );
        }
      }
    }
  }

  async function stopPolling(): Promise<void> {
    isRunning = false;
    // Cancel any pending getUpdates request by making a new one with a very short timeout
    try {
      await makeRequest('getUpdates', 'POST', {
        timeout: 0,
        offset: -1,
      });
    } catch (error) {
      console.error('Error while stopping polling:', error);
    }
  }

  return {
    sendDeletableMessage,
    handleCallback,
    startPolling,
    stopPolling,
  };
}

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
