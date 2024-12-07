import { createSlackProcessor } from '../../processors/slack';
import type { Message } from '../../types';

describe('SlackProcessor', () => {
  const mockConfig = {
    webhookUrl: 'https://hooks.slack.com/test',
    channel: '#test-channel',
    username: 'TestBot'
  };

  beforeEach(() => {
    // Mock the native fetch
    (global.fetch as jest.Mock) = jest.fn(() => 
      Promise.resolve({ ok: true })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should format messages with appropriate emojis', async () => {
    const processor = createSlackProcessor(mockConfig);
    const messages: Message[] = [
      { chatId: 'test', text: 'info message', level: 'info' },
      { chatId: 'test', text: 'warning message', level: 'warning' },
      { chatId: 'test', text: 'error message', level: 'error' }
    ];

    await processor.processBatch(messages);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    
    expect(url).toBe(mockConfig.webhookUrl);
    const body = JSON.parse(options.body);
    expect(body.channel).toBe(mockConfig.channel);
    expect(body.username).toBe(mockConfig.username);
    
    expect(body.blocks[0].text.text).toContain(':information_source: info message');
    expect(body.blocks[1].text.text).toContain(':warning: warning message');
    expect(body.blocks[2].text.text).toContain(':rotating_light: error message');
  });

  it('should use default username when not provided', async () => {
    const configWithoutUsername = {
      webhookUrl: mockConfig.webhookUrl,
      channel: mockConfig.channel
    };
    const processor = createSlackProcessor(configWithoutUsername);
    
    const messages: Message[] = [
      { chatId: 'test', text: 'test message', level: 'info' }
    ];

    await processor.processBatch(messages);

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.username).toBeUndefined();
  });

  it('should not make API call for empty messages', async () => {
    const processor = createSlackProcessor(mockConfig);
    await processor.processBatch([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});