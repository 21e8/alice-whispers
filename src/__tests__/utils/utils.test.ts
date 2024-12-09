import { EMOJI_MAP, sendTelegramMessage } from '../../utils';

describe('Utils', () => {
  describe('EMOJI_MAP', () => {
    it('should have correct emoji mappings', () => {
      expect(EMOJI_MAP.info).toBe('ℹ️');
      expect(EMOJI_MAP.warning).toBe('⚠️');
      expect(EMOJI_MAP.error).toBe('🚨');
      expect(EMOJI_MAP.none).toBe('🔕');
    });

    it('should have all required notification levels', () => {
      const levels = ['info', 'warning', 'error', 'none'] as const;
      levels.forEach(level => {
        expect(EMOJI_MAP[level]).toBeDefined();
        expect(typeof EMOJI_MAP[level]).toBe('string');
      });
    });
  });

  describe('sendTelegramMessage', () => {
    const mockFetch = global.fetch as jest.Mock;

    beforeEach(() => {
      mockFetch.mockClear();
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
        })
      );
    });

    it('should send message with correct parameters', async () => {
      const message = 'Test message';
      const botToken = 'test-token';
      const chatId = 'test-chat';

      await sendTelegramMessage(message, botToken, chatId);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        }
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad Request'),
        })
      );

      await expect(
        sendTelegramMessage('test', 'token', 'chat')
      ).rejects.toThrow('Failed to send Telegram notification: Bad Request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(
        sendTelegramMessage('test', 'token', 'chat')
      ).rejects.toThrow('Error sending Telegram notification: Error: Network error');
    });

    it('should handle empty message', async () => {
      await sendTelegramMessage('', 'token', 'chat');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"text":""'),
        })
      );
    });

    it('should handle special characters in message', async () => {
      const message = 'Test *bold* _italic_ `code` [link](http://example.com)';
      await sendTelegramMessage(message, 'token', 'chat');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining(message),
        })
      );
    });
  });
}); 