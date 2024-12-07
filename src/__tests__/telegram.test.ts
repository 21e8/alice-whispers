import { TelegramProcessor } from '../processors/telegram';
import sinon from 'sinon';
import { type Message, type TelegramConfig } from '../types';

describe('TelegramProcessor', () => {
  let fetchStub: sinon.SinonStub;
  const defaultConfig: TelegramConfig = {
    botToken: 'test-token',
    chatId: 'test-chat-id'
  };

  beforeEach(() => {
    fetchStub = sinon.stub().resolves({ ok: true });
    global.fetch = fetchStub;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should send formatted messages to telegram API', async () => {
    const processor = new TelegramProcessor(defaultConfig);
    const messages: Message[] = [
      { chatId: 'default', text: 'info message', level: 'info' },
      { chatId: 'default', text: 'warning message', level: 'warning' },
      { chatId: 'default', text: 'error message', level: 'error' }
    ];

    await processor.processBatch(messages);

    sinon.assert.calledOnce(fetchStub);
    sinon.assert.calledWith(
      fetchStub,
      `https://api.telegram.org/bot${defaultConfig.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: defaultConfig.chatId,
          text: 'ℹ️ info message\n\n⚠️ warning message\n\n🚨 error message',
          parse_mode: 'HTML'
        })
      }
    );
  });

  it('should not send messages in development mode', async () => {
    const processor = new TelegramProcessor({
      ...defaultConfig,
      development: true
    });
    const messages: Message[] = [
      { chatId: 'default', text: 'test message', level: 'info' }
    ];

    await processor.processBatch(messages);

    sinon.assert.notCalled(fetchStub);
  });

  it('should throw error on failed API response', async () => {
    fetchStub.resolves({ ok: false, statusText: 'Bad Request' });
    const processor = new TelegramProcessor(defaultConfig);
    const messages: Message[] = [
      { chatId: 'default', text: 'test message', level: 'info' }
    ];

    await expect(processor.processBatch(messages))
      .rejects
      .toThrow('Failed to send message to Telegram: Bad Request');
  });

  it('should handle empty message batch', async () => {
    const processor = new TelegramProcessor(defaultConfig);
    await processor.processBatch([]);
    sinon.assert.notCalled(fetchStub);
  });

  it('should format messages with correct emojis', async () => {
    const processor = new TelegramProcessor(defaultConfig);
    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
      { chatId: 'default', text: 'test3', level: 'error' }
    ];

    await processor.processBatch(messages);

    const expectedText = 'ℹ️ test1\n\n⚠️ test2\n\n🚨 test3';
    sinon.assert.calledWithMatch(
      fetchStub,
      sinon.match.any,
      sinon.match({
        body: JSON.stringify({
          chat_id: defaultConfig.chatId,
          text: expectedText,
          parse_mode: 'HTML'
        })
      })
    );
  });

  it('should log messages to console in development mode', async () => {
    const consoleSpy = sinon.spy(console, 'log');
    const processor = new TelegramProcessor({
      ...defaultConfig,
      development: true
    });
    const messages: Message[] = [
      { chatId: 'default', text: 'test message', level: 'info' }
    ];

    await processor.processBatch(messages);

    sinon.assert.calledWith(
      consoleSpy,
      'Development mode, not sending to Telegram:',
      messages
    );
  });
}); 