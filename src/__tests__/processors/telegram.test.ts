import { createTelegramProcessor } from '../../processors/telegram';
import type { Message, TelegramConfig } from '../../types';
import Queue from '../../utils/queue';
import { MockResponse } from '../test-utils';
import { createMessageBatcher } from '../../batcher';

describe('TelegramProcessor', () => {
  const defaultConfig: TelegramConfig = {
    botToken: 'test-token',
    chatId: 'test-chat-id',
  };

  beforeEach(() => {
    // Mock fetch
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve(new MockResponse())
    );
    // Silence console output except for specific tests
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send formatted messages to telegram API', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    const messages = new Queue<Message>();
    messages.enqueue(['default', 'info message', 'info', undefined]);
    messages.enqueue(['default', 'warning message', 'warning', undefined]);
    messages.enqueue(['default', 'error message', 'error', undefined]);

    await processor.processBatch(messages.toArray());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe(
      `https://api.telegram.org/bot${defaultConfig.botToken}/sendMessage`
    );
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      chat_id: defaultConfig.chatId,
      text: 'ℹ️ info message\n\n⚠️ warning message\n\n🚨 error message',
      parse_mode: 'HTML',
    });
  });

  it('should not send messages in development mode', async () => {
    const consoleSpy = jest.spyOn(console, 'debug');
    const processor = createTelegramProcessor({
      ...defaultConfig,
      development: true,
    });
    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test message', 'info', undefined]);

    await processor.processBatch(messages.toArray());

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[Telegram] Would send messages:', [
      ['default', 'test message', 'info', undefined],
    ]);
    consoleSpy.mockRestore();
  });

  it('should throw error on failed API response', async () => {
    const errorResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request: message text is empty',
    };

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(new MockResponse(errorResponse))
    );

    const processor = createTelegramProcessor(defaultConfig);
    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test message', 'info', undefined]);

    await expect(processor.processBatch(messages.toArray())).rejects.toThrow(
      `Failed to send Telegram message: 400 Bad Request: message text is empty`
    );

    expect(console.error).toHaveBeenCalledWith(
      '[Telegram] API Response:',
      `Bad Request: message text is empty`
    );
  });

  it('should handle API errors with missing status text', async () => {
    const errorResponse = {
      ok: false,
      error_code: 400,
      statusText: 'Unknown Error',
    };

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(new MockResponse(errorResponse))
    );

    const processor = createTelegramProcessor(defaultConfig);
    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test', 'info', undefined]);
    await expect(processor.processBatch(messages.toArray())).rejects.toThrow(
      `Failed to send Telegram message: 400 Unknown Error`
    );
  });

  it('should handle empty formatted messages', async () => {
    const consoleSpy = jest.spyOn(console, 'debug');
    const processor = createTelegramProcessor(defaultConfig);
    const messages = new Queue<Message>();
    messages.enqueue(['default', '   ', 'info', undefined]); // whitespace only
    messages.enqueue(['default', '', 'info', undefined]); // empty string

    await processor.processBatch(messages.toArray());

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[Telegram] No messages to send');
    consoleSpy.mockRestore();
  });

  it('should format error messages with error details', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    const error = new Error('Test error');
    const messages = new Queue<Message>();
    messages.enqueue(['default', 'Error occurred', 'error', error]);

    await processor.processBatch(messages.toArray());

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.text).toContain('🚨 Error occurred');
    expect(body.text).toContain('Test error');
  });

  it('should handle empty message array', async () => {
    const consoleSpy = jest.spyOn(console, 'debug');
    const processor = createTelegramProcessor(defaultConfig);

    await processor.processBatch([]);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[Telegram] No messages to send');
    consoleSpy.mockRestore();
  });

  it('should handle non-ok response from API', async () => {
    const batcher = createMessageBatcher({
      maxBatchSize: 1,
      maxWaitMs: 100,
    });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    // const processor = createTelegramProcessor(defaultConfig);
    const errorResponse = {
      // ok: false,
      error_code: 429,
      description: 'Too Many Requests: retry after 60',
      // parameters: {
      //   retry_after: 60
      // }
    };

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error(errorResponse.description))
    );

    const processor = createTelegramProcessor(defaultConfig);
    batcher.addProcessor(processor);
    batcher.error('test message', new Error('test error'));
    await batcher.flush();
    // await expect(processor.processBatch(messages.toArray())).rejects.toThrow(
    //   'Failed to send Telegram message: 429 Too Many Requests\nToo Many Requests: retry after 60'
    // );

    expect(console.error).toHaveBeenCalledWith(
      '[Telegram] API Response: ',
      errorResponse.description
    );
    consoleSpy.mockRestore();
    await batcher.destroy();
  });
});
