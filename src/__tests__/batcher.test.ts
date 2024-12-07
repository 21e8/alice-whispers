import { createMessageBatcher } from '../batcher';
import type { Message, MessageProcessor } from '../types';

describe('MessageBatcher', () => {
  let mockProcessor: MessageProcessor;
  let processedMessages: Message[];

  beforeEach(() => {
    processedMessages = [];
    mockProcessor = {
      processBatch: jest.fn(async (messages) => {
        processedMessages = messages;
      }),
    };
  });

  it('should handle info messages correctly', async () => {
    const batcher = createMessageBatcher([mockProcessor], {
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
    const batcher = createMessageBatcher([mockProcessor], {
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
    const batcher = createMessageBatcher([mockProcessor], {
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
    const batcher = createMessageBatcher([mockProcessor], {
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
    const batcher = createMessageBatcher([mockProcessor], {
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
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    
    const batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    batcher.info('Test message');
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0].text).toBe('Test message');

    setIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should handle processor failures gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const failingProcessor: MessageProcessor = {
      processBatch: jest.fn().mockRejectedValue(new Error('Process failed')),
    };

    const batcher = createMessageBatcher([failingProcessor], {
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

  it('should clean up resources on destroy', async () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    const batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    batcher.destroy();
    expect(clearIntervalSpy).toHaveBeenCalled();
    
    batcher.info('Should not process');
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(processedMessages).toHaveLength(0);

    clearIntervalSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should process batch when maxBatchSize is reached', async () => {
    const batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    batcher.info('Message 1');
    expect(processedMessages).toHaveLength(0);

    batcher.info('Message 2'); // This should trigger processing
    await Promise.resolve(); // Wait for async processing

    expect(processedMessages).toHaveLength(2);
    expect(processedMessages.map(m => m.text)).toEqual([
      'Message 1',
      'Message 2'
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
