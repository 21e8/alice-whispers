import { createMessageBatcher, resetBatcher } from '../batcher';
import type { Message, MessageBatcher, MessageProcessor } from '../types';

describe('MessageBatcher', () => {
  let mockProcessor: MessageProcessor;
  let processedMessages: Message[];
  let batcher: MessageBatcher;

  beforeEach(() => {
    processedMessages = [];
    mockProcessor = {
      processBatch: jest.fn(async (messages) => {
        processedMessages = messages;
      }),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (batcher) {
      batcher.destroy();
    }
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should handle info messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.info('Test info message');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Test info message',
      level: 'info',
    });
  });

  it('should handle warning messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.warning('Test warning message');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Test warning message',
      level: 'warning',
    });
  });

  it('should handle error messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const testError = new Error('Test error occurred');
    batcher.error('Test error message', testError);
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Test error message',
      level: 'error',
      error: testError,
    });
  });

  it('should batch multiple messages of different levels', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const testError = new Error('Some error');
    batcher.info('Info message');
    batcher.warning('Warning message');
    batcher.error('Error message', testError);
    await batcher.flush();

    expect(processedMessages).toHaveLength(3);
    expect(processedMessages).toEqual([
      {
        chatId: 'default',
        text: 'Info message',
        level: 'info',
      },
      {
        chatId: 'default',
        text: 'Warning message',
        level: 'warning',
      },
      {
        chatId: 'default',
        text: 'Error message',
        level: 'error',
        error: testError,
      },
    ]);
  });

  it('should handle undefined error object', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.error('Error without error object');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Error without error object',
      level: 'error',
    });
  });

  it('should process messages after maxWaitMs', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    batcher.info('Test message');
    expect(processedMessages).toHaveLength(0);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0].text).toBe('Test message');

    setIntervalSpy.mockRestore();
  });

  it('should handle processor failures gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const failingProcessor: MessageProcessor = {
      processBatch: jest.fn().mockRejectedValue(new Error('Process failed')),
    };

    batcher = createMessageBatcher([failingProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 100,
    });

    batcher.info('Test message');
    await batcher.flush();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor 0 failed:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should clean up all timers on destroy', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    batcher.info('test message');
    batcher.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should process batch when maxBatchSize is reached', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    // Wait for initial setup
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    // Clear processed messages from setup
    processedMessages = [];
    (mockProcessor.processBatch as jest.Mock).mockClear();

    // Add first message - shouldn't trigger processing
    batcher.info('Message 1');
    await Promise.resolve();
    expect(processedMessages).toHaveLength(0);

    // Add second message - should trigger immediate processing
    batcher.info('Message 2');
    await Promise.resolve();

    expect(processedMessages).toHaveLength(2);
    expect(processedMessages.map((m) => m.text)).toEqual([
      'Message 1',
      'Message 2',
    ]);
  });

  it('should clear all queues when reset', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    batcher.info('Message 1');
    batcher.warning('Message 2');

    // Reset before processing
    resetBatcher();
    await batcher.flush();

    expect(processedMessages).toHaveLength(0);
  });

  it('should process messages synchronously with flushSync', async () => {
    const processBatchSpy = jest.fn().mockResolvedValue(undefined);
    const syncProcessor = { processBatch: processBatchSpy };
    
    batcher = createMessageBatcher([syncProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    batcher.info('Message 1');
    batcher.info('Message 2');
    batcher.flushSync();

    expect(processBatchSpy).toHaveBeenCalledTimes(2);
    expect(processBatchSpy).toHaveBeenNthCalledWith(1, [{
      chatId: 'default',
      text: 'Message 1',
      level: 'info',
      error: undefined,
    }]);
    expect(processBatchSpy).toHaveBeenNthCalledWith(2, [{
      chatId: 'default',
      text: 'Message 2',
      level: 'info',
      error: undefined,
    }]);
  });

  it('should handle processor errors during sync flush', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processBatchSpy = jest.fn(() => Promise.reject(new Error('Process failed')));
    const failingProcessor = { processBatch: processBatchSpy };

    batcher = createMessageBatcher([failingProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    batcher.info('Test message');
    batcher.flushSync();

    expect(processBatchSpy).toHaveBeenCalledWith([{
      chatId: 'default',
      text: 'Test message',
      level: 'info',
      error: undefined,
    }]);

    // Wait for the next tick to ensure error is logged
    setImmediate(() => {
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
