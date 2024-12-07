import { createTelegramProcessor } from '../../processors/telegram';
import type { Message, TelegramConfig } from '../../types';

describe('TelegramProcessor', () => {
  const defaultConfig: TelegramConfig = {
    botToken: 'test-token',
    chatId: 'test-chat-id'
  };

  beforeEach(() => {
    // Updated mock implementation
    (global.fetch as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({})
      } as Response)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send formatted messages to telegram API', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    const messages: Message[] = [
      { chatId: 'default', text: 'info message', level: 'info' },
      { chatId: 'default', text: 'warning message', level: 'warning' },
      { chatId: 'default', text: 'error message', level: 'error' }
    ];

    await processor.processBatch(messages);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    
    expect(url).toBe(`https://api.telegram.org/bot${defaultConfig.botToken}/sendMessage`);
    const body = JSON.parse(options.body);
    expect(body).toEqual({
      chat_id: defaultConfig.chatId,
      text: '[INFO] info message\n[WARNING] warning message\n[ERROR] error message',
      parse_mode: 'HTML'
    });
  });

  it('should not send messages in development mode', async () => {
    const processor = createTelegramProcessor({
      ...defaultConfig,
      development: true
    });
    const messages: Message[] = [
      { chatId: 'default', text: 'test message', level: 'info' }
    ];

    await processor.processBatch(messages);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should throw error on failed API response', async () => {
    // Updated mock implementation for failed response
    (global.fetch as jest.Mock).mockImplementationOnce(() => 
      Promise.resolve({ 
        ok: false, 
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({})
      } as Response)
    );

    const processor = createTelegramProcessor(defaultConfig);
    const messages: Message[] = [
      { chatId: 'default', text: 'test message', level: 'info' }
    ];

    await expect(processor.processBatch(messages))
      .rejects
      .toThrow('Telegram API error: Bad Request');
  });

  it('should handle empty message batch', async () => {
    const processor = createTelegramProcessor(defaultConfig);
    await processor.processBatch([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should log messages to console in development mode', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const processor = createTelegramProcessor({
      ...defaultConfig,
      development: true
    });
    const messages: Message[] = [
      { chatId: 'default', text: 'test message', level: 'info' }
    ];

    await processor.processBatch(messages);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[Telegram] Would send messages:',
      messages
    );
    consoleSpy.mockRestore();
  });
});