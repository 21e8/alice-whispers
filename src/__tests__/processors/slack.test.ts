import { SlackProcessor } from '../../processors/slack';
import type { SlackConfig } from '../../processors/slack';
import type { Message } from '../../types';

jest.mock('node-fetch', () => {
  return jest.fn();
});

describe('SlackProcessor', () => {
  let processor: SlackProcessor;
  const mockConfig = {
    webhookUrl: 'https://hooks.slack.com/test',
    channel: '#test-channel',
    username: 'TestBot'
  };

  beforeEach(() => {
    processor = new SlackProcessor(mockConfig);
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
    expect(body.channel).toBe(mockConfig.channel);
    expect(body.username).toBe(mockConfig.username);
    
    expect(body.blocks[0].text.text).toContain(':information_source: info message');
    expect(body.blocks[1].text.text).toContain(':warning: warning message');
    expect(body.blocks[2].text.text).toContain(':rotating_light: error message');
  });

//   it('should handle empty message batch', async () => {
//     const fetch = jest.requireMock('node-fetch');
//     await processor.processBatch([]);
//     expect(fetch).not.toHaveBeenCalled();
//   });

  it('should use default username when not provided', async () => {
    const configWithoutUsername = {
      webhookUrl: mockConfig.webhookUrl,
      channel: mockConfig.channel
    };
    const basicProcessor = new SlackProcessor(configWithoutUsername);
    
    const messages: Message[] = [
      { chatId: 'test', text: 'test message', level: 'info' }
    ];

    const fetch = jest.requireMock('node-fetch');
    fetch.mockResolvedValueOnce({ ok: true });

    await basicProcessor.processBatch(messages);

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.username).toBeUndefined();
  });
});

// Make sure this is a module
export {}; 