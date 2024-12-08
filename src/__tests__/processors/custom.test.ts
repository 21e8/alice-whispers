import { createCustomProcessor } from '../../processors/custom';
import type { Message } from '../../types';
import Queue from '../../utils/queue';

describe('createCustomProcessor', () => {
  it('should create a processor with async processBatch', async () => {
    const processBatchMock = jest.fn();
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: processBatchMock,
    });

    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test', 'info']);
    await processor.processBatch(messages);

    expect(processBatchMock).toHaveBeenCalledWith([
      ['default', 'test', 'info', undefined],
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

    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test', 'info']);
    processor.processBatchSync?.(messages);

    expect(processBatchSyncMock).toHaveBeenCalledWith([
      ['default', 'test', 'info', undefined],
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

    // Create separate queues for async and sync processing
    const asyncMessages = new Queue<Message>();
    asyncMessages.enqueue(['default', 'test', 'info']);
    await processor.processBatch(asyncMessages);

    const syncMessages = new Queue<Message>();
    syncMessages.enqueue(['default', 'test', 'info']);
    processor.processBatchSync?.(syncMessages);

    expect(processBatchMock).toHaveBeenCalledWith([
      ['default', 'test', 'info', undefined],
    ]);
    expect(processBatchSyncMock).toHaveBeenCalledWith([
      ['default', 'test', 'info', undefined],
    ]);
  });

  it('should handle errors in async processBatch', async () => {
    const error = new Error('Test error');
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: async () => {
        throw error;
      },
    });

    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test', 'info']);
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

    const messages = new Queue<Message>();
    messages.enqueue(['default', 'test', 'info']);
    expect(() => processor.processBatchSync?.(messages)).toThrow(error);
  });
});
