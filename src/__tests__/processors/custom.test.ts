import { createCustomProcessor } from '../../processors/custom';
import type { Message } from '../../types';

describe('createCustomProcessor', () => {
  it('should create a processor with async processBatch', async () => {
    const processBatchMock = jest.fn();
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: processBatchMock,
    });

    const messages: Message[] = [['default', 'test', 'info']];
    await processor.processBatch(messages);

    expect(processBatchMock).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test',
        level: 'info',
      },
    ]);
    expect(processor.name).toBe('test');
    expect(processor.type).toBe('external');
  });

  it('should create a processor with sync processBatch', () => {
    const processBatchSyncMock = jest.fn();
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: () => Promise.resolve(),
      processBatchSync: processBatchSyncMock,
    });

    const messages: Message[] = [['default', 'test', 'info']];
    processor.processBatchSync?.(messages);

    expect(processBatchSyncMock).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test',
        level: 'info',
      },
    ]);
    expect(processor.name).toBe('test');
  });

  it('should handle both sync and async methods', async () => {
    const processBatchMock = jest.fn();
    const processBatchSyncMock = jest.fn();
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: processBatchMock,
      processBatchSync: processBatchSyncMock,
    });

    const messages: Message[] = [['default', 'test', 'info']];
    await processor.processBatch(messages);
    processor.processBatchSync?.(messages);

    expect(processBatchMock).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test',
        level: 'info',
      },
    ]);
    expect(processBatchSyncMock).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test',
        level: 'info',
      },
    ]);
  });

  it('should handle errors in async processBatch', async () => {
    const error = new Error('Test error');
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: () => {
        throw error;
      },
    });

    const messages: Message[] = [['default', 'test', 'info']];
    await expect(processor.processBatch(messages)).rejects.toThrow(error);
  });

  it('should handle errors in sync processBatch', () => {
    const error = new Error('Test error');
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: () => Promise.resolve(),
      processBatchSync: () => {
        throw error;
      },
    });

    const messages: Message[] = [['default', 'test', 'info']];
    expect(() => processor.processBatchSync?.(messages)).toThrow(error);
  });
});
