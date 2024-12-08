import { BatchAggregateError, createMessageBatcher } from '../batcher';
import type { MessageBatcher, ExternalMessageProcessor, Message } from '../types';
import Queue from '../utils/queue';

describe('MessageBatcher', () => {
  let mockProcessor: ExternalMessageProcessor;
  let processedMessages: Queue<Message>;
  let batcher: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    processedMessages = new Queue<Message>();
    mockProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatch: jest.fn(async (messages) => {
        for (const msg of messages) {
          processedMessages.enqueue(msg);
        }
      }),
    } as const;
  });

  afterEach(async () => {
    if (batcher) {
      await batcher.destroy();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should process messages with concurrent processors', async () => {
    const processBatchSpy = jest.fn();
    const extraProcessor = {
      type: 'external' as const,
      name: 'extra',
      processBatch: processBatchSpy,
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2,
    });

    batcher.addProcessor(mockProcessor);
    batcher.addProcessor(extraProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(processBatchSpy).toHaveBeenCalledWith([
      ['default', 'test message', 'info', undefined],
    ]);
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      ['default', 'test message', 'info', undefined],
    ]);
  });

  it('should handle info messages correctly', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);
    batcher.info('Test info message');
    await batcher.flush();

    expect(processedMessages.size).toBe(1);
    expect(processedMessages.dequeue()).toEqual([
      'default',
      'Test info message',
      'info',
      undefined,
    ]);
  });

  it('should handle warning messages correctly', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);
    batcher.warning('Test warning message');
    await batcher.flush();

    expect(processedMessages.size).toBe(1);
    expect(processedMessages.dequeue()).toEqual([
      'default',
      'Test warning message',
      'warning',
      undefined,
    ]);
  });

  it('should handle error messages correctly', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);
    const testError = new Error('Test error occurred');
    batcher.error('Test error message', testError);
    await batcher.flush();

    expect(processedMessages.size).toBe(1);
    expect(processedMessages.dequeue()).toEqual([
      'default',
      'Test error message',
      'error',
      testError,
    ]);
  });

  it('should handle processor removal', async () => {
    const extraProcessor = {
      type: 'external' as const,
      name: 'extra',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(extraProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(extraProcessor.processBatch).toHaveBeenCalled();

    batcher.removeProcessor(extraProcessor.name);
    batcher.info('another message');
    await batcher.flush();

    expect(extraProcessor.processBatch).toHaveBeenCalledTimes(1);
  });

  it('should handle processor removal with invalid name', async () => {
    const consoleSpy = jest.spyOn(console, 'error');

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.removeProcessor('invalid');
    expect(consoleSpy).toHaveBeenCalledWith('Processor invalid not found');
    consoleSpy.mockRestore();
  });

  it('should process batch when maxBatchSize is reached', async () => {
    const processBatchSpy = jest.fn();
    const testProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatch: processBatchSpy,
    };

    batcher = createMessageBatcher({
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    batcher.addProcessor(testProcessor);

    // Add messages up to maxBatchSize
    batcher.info('message 1');
    batcher.info('message 2');

    // Run timers and wait for processing
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    const messages: Message[] = [
      ['default', 'message 1', 'info', undefined],
      ['default', 'message 2', 'info', undefined],
    ];

    expect(processBatchSpy).toHaveBeenCalledWith(messages);
  });

  it('should handle sync processor errors', () => {
    const error = new Error('Sync error');
    const errorProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatchSync: jest.fn().mockImplementation(() => {
        throw error;
      }),
      processBatch: jest.fn().mockImplementation(() => {
        throw error;
      }),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(errorProcessor);

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');

    expect(() => batcher.flushSync()).toThrow(BatchAggregateError);

    expect(consoleSpy).toHaveBeenCalledWith('Processor mock failed:', error);
    consoleSpy.mockRestore();
  });

  it('should handle async processor errors', async () => {
    const error = new Error('Async error');
    const errorProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatch: async () => {
        throw error;
      },
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(errorProcessor);

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');

    try {
      await batcher.flush();
      fail('Expected BatchAggregateError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BatchAggregateError);
      const batchError = e as BatchAggregateError;
      expect(batchError.errors[0]).toBe(error);
    }

    expect(consoleSpy).toHaveBeenCalledWith('Processor mock failed:', error);
    consoleSpy.mockRestore();
  });

  it('should handle batch processing errors', async () => {
    const errorProcessor = {
      type: 'external' as const,
      name: 'error',
      processBatch: undefined as any,
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(errorProcessor);
    batcher.info('test message');

    try {
      await batcher.flush();
      fail('Expected BatchAggregateError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BatchAggregateError);
      const batchError = e as BatchAggregateError;
      expect(batchError.errors[0].message).toBe('processor.processBatch is not a function');
    }
  });

  it('should handle multiple concurrent processors with different speeds', async () => {
    const slowProcessor = {
      type: 'external' as const,
      name: 'slow',
      processBatch: jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }),
    };

    const fastProcessor = {
      type: 'external' as const,
      name: 'fast',
      processBatch: jest.fn(async () => {
        await Promise.resolve();
      }),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2,
    });

    batcher.addProcessor(slowProcessor);
    batcher.addProcessor(fastProcessor);
    batcher.info('test message');

    const flushPromise = batcher.flush();
    jest.advanceTimersByTime(100);
    await flushPromise;

    expect(slowProcessor.processBatch).toHaveBeenCalled();
    expect(fastProcessor.processBatch).toHaveBeenCalled();
  });

  it('should handle duplicate processor error', () => {
    const consoleSpy = jest.spyOn(console, 'error');

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor({
      type: 'external',
      name: 'mock',
      processBatch: jest.fn(),
    });

    batcher.addProcessor({
      type: 'external',
      name: 'mock',
      processBatch: jest.fn(),
    });

    expect(consoleSpy).toHaveBeenCalledWith('Processor mock already exists');
    consoleSpy.mockRestore();
  });

  it('should process messages on interval', async () => {
    const mockProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);
    batcher.info('test message');

    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Let any pending promises resolve

    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      ['default', 'test message', 'info', undefined],
    ]);
  });

  it('should handle removeAllExtraProcessors with mixed processor types', async () => {
    const externalProcessor = {
      type: 'external' as const,
      name: 'external',
      processBatch: jest.fn(),
    };

    const internalProcessor = {
      type: 'internal' as const,
      name: 'internal',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(externalProcessor);
    batcher.addProcessor(internalProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(externalProcessor.processBatch).toHaveBeenCalled();
    expect(internalProcessor.processBatch).toHaveBeenCalled();

    // Remove external processors
    batcher.removeAllProcessors();
    batcher.info('another message');
    await batcher.flush();

    expect(externalProcessor.processBatch).toHaveBeenCalledTimes(1);
    expect(internalProcessor.processBatch).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple errors from different processors', async () => {
    const error1 = new Error('Error 1');
    const error2 = new Error('Error 2');

    const failingProcessor1 = {
      type: 'external' as const,
      name: 'failing1',
      processBatch: jest.fn().mockRejectedValue(error1),
    };

    const failingProcessor2 = {
      type: 'external' as const,
      name: 'failing2',
      processBatch: jest.fn().mockRejectedValue(error2),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2,
    });

    batcher.addProcessor(failingProcessor1);
    batcher.addProcessor(failingProcessor2);
    batcher.info('test message');

    try {
      await batcher.flush();
      fail('Expected BatchAggregateError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BatchAggregateError);
      const batchError = e as BatchAggregateError;
      expect(batchError.errors).toContain(error1);
      expect(batchError.errors).toContain(error2);
    }
  });

  it('should handle errors during destroy', async () => {
    const error = new Error('Process error');
    const failingProcessor = {
      type: 'external' as const,
      name: 'failing',
      processBatch: jest.fn().mockRejectedValue(error),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(failingProcessor);
    batcher.info('test message');

    const consoleSpy = jest.spyOn(console, 'error');
    await batcher.destroy();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error processing remaining messages during destroy:',
      expect.any(BatchAggregateError)
    );
    consoleSpy.mockRestore();
  });
});
