import { DiscordProcessor } from '../../processors/discord';
import { Message } from '../../types';

jest.mock('node-fetch', () => {
  return jest.fn();
});

describe('DiscordProcessor', () => {
  let processor: DiscordProcessor;
  const mockConfig = {
    webhookUrl: 'https://discord.com/api/webhooks/test',
    username: 'TestBot'
  };

  beforeEach(() => {
    processor = new DiscordProcessor(mockConfig);
    const fetch = jest.requireMock('node-fetch');
    fetch.mockClear();
  });

  it('should format messages with appropriate emojis', async () => {
    const messages: Message[] = [
      { chatId: 'test', text: 'info message', level: 'info' },
      { chatId: 'test', text: 'warning message', level: 'warning' },
      { chatId: 'test', text: 'error message', level: 'error' }
    ];

    const fetch = jest.requireMock('node-fetch');
    fetch.mockResolvedValueOnce({ ok: true });

    await processor.processBatch(messages);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    
    expect(url).toBe(mockConfig.webhookUrl);
    const body = JSON.parse(options.body);
    expect(body.username).toBe(mockConfig.username);
    
    expect(body.content).toMatch(/info message/);
    expect(body.content).toContain('⚠️ warning message');
    expect(body.content).toContain('🚨 error message');
  });

  it('should send empty content for empty message batch', async () => {
    const fetch = jest.requireMock('node-fetch');
    await processor.processBatch([]);
    
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.content).toBe('');
  });

  it('should use default username when not provided', async () => {
    const configWithoutUsername = {
      webhookUrl: mockConfig.webhookUrl
    };
    const basicProcessor = new DiscordProcessor(configWithoutUsername);
    
    const messages: Message[] = [
      { chatId: 'test', text: 'test message', level: 'info' }
    ];

    const fetch = jest.requireMock('node-fetch');
    fetch.mockResolvedValueOnce({ ok: true });

    await basicProcessor.processBatch(messages);

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.username).toBeUndefined();
  });

  it('should join multiple messages with newlines', async () => {
    const messages: Message[] = [
      { chatId: 'test', text: 'first message', level: 'info' },
      { chatId: 'test', text: 'second message', level: 'info' }
    ];

    const fetch = jest.requireMock('node-fetch');
    fetch.mockResolvedValueOnce({ ok: true });

    await processor.processBatch(messages);

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.content.split('\n\n').length).toBe(2);
  });
}); 