import { createTelegramProcessor } from '../../processors/telegram';
import type { Message, TelegramConfig } from '../../types';

describe('TelegramProcessor', () => {
  const defaultConfig: TelegramConfig = {
    botToken: 'test-token',
    chatId: 'test-chat-id',
  };

  beforeEach(() => {
    // Mock fetch
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({}),
      } as Response)
    );
    // Silence console output except for specific tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send formatted messages to telegram API', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    const messages: Message[] = [
      ['default', 'info message', 'info'],
      ['default', 'warning message', 'warning'],
      ['default', 'error message', 'error'],
    ];

    await processor.processBatch(messages);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe(
      `https://api.telegram.org/bot${defaultConfig.botToken}/sendMessage`
    );
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      chat_id: defaultConfig.chatId,
      text: 'ℹ️ [INFO] info message\n⚠️ [WARNING] warning message\n🚨 [ERROR] error message',
      parse_mode: 'HTML',
    });
  });

  it('should not send messages in development mode', async () => {
    const processor = createTelegramProcessor({
      ...defaultConfig,
      development: true,
    });
    const messages: Message[] = [['default', 'test message', 'info']];

    await processor.processBatch(messages);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should throw error on failed API response', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    // Updated mock implementation for failed response
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            ok: false,
            error_code: 400,
            description: 'Bad Request: message text is empty',
          }),
      } as Response)
    );

    const processor = createTelegramProcessor(defaultConfig);
    const messages: Message[] = [['default', 'test message', 'info']];

    await expect(processor.processBatch(messages)).rejects.toThrow(
      'Telegram API error: Bad Request - Bad Request: message text is empty'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Telegram] API Response:',
      expect.objectContaining({
        ok: false,
        error_code: 400,
        description: expect.any(String),
      })
    );
  });

  it('should handle empty message batch', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    await processor.processBatch([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should log messages to console in development mode', async () => {
    // Restore console.log for this test
    (console.log as jest.Mock).mockRestore();
    const consoleSpy = jest.spyOn(console, 'log');

    const processor = createTelegramProcessor({
      ...defaultConfig,
      development: true,
    });
    const messages: Message[] = [['default', 'test message', 'info']];

    await processor.processBatch(messages);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Telegram] Would send messages:',
      messages
    );
    consoleSpy.mockRestore();
  });

  it('should handle API errors with missing status text', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            ok: false,
            error_code: 400,
            description: 'Unknown Error',
          }),
      } as Response)
    );

    const processor = createTelegramProcessor(defaultConfig);
    const messages = [['default', 'test', 'info']] as Message[];

    await expect(processor.processBatch(messages)).rejects.toThrow(
      'Telegram API error: Unknown Error - Unknown Error'
    );
  });

  it('should handle empty formatted messages', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    const messages: Message[] = [
      ['default', '   ', 'info', undefined], // whitespace only
      ['default', '', 'info', undefined], // empty string
    ];

    const consoleSpy = jest.spyOn(console, 'log');
    await processor.processBatch(messages);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('[Telegram] No messages to send');
    consoleSpy.mockRestore();
  });

  it('should format error messages with error details', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    const error = new Error('Test error');
    const messages: Message[] = [['default', 'Error occurred', 'error', error]];

    await processor.processBatch(messages);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.text).toContain('🚨 [ERROR] Error occurred');
    expect(body.text).toContain('Test error');
  });
});
