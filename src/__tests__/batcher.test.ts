/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMessageBatcher } from '../batcher';
import { addErrorPatterns } from '../utils/classify';
import {
  MessageBatcher,
  Message,
  MessageProcessor,
  BatchAggregateError,
} from '../types';
import Queue from '../utils/queue';

describe('MessageBatcher', () => {
  let mockProcessor: MessageProcessor;
  let processedMessages: Queue<Message>;
  let batcher: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    processedMessages = new Queue<Message>();
    mockProcessor = {
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
      name: 'mock',
      processBatch: () => {
        throw error;
      },
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(errorProcessor);
    batcher.info('test message');

    try {
      batcher.flushSync();
      fail('Expected BatchAggregateError to be thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BatchAggregateError);
      const batchError = e as BatchAggregateError;
      expect(batchError.errors.dequeue()?.message).toBe('Sync error');
    }
  });

  it('should handle async processor errors', async () => {
    const error = new Error('Async error');
    const errorProcessor = {
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
    batcher.info('test message');

    const errors = await batcher.flush();
    expect(errors.size).toBe(1);
    expect(errors.dequeue()?.message).toBe('Async error');
  });

  it('should handle batch processing errors', async () => {
    const errorProcessor = {
      name: 'error',
      processBatch: undefined as any,
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(errorProcessor);
    batcher.info('test message');

    const errors = await batcher.flush();
    expect(errors.size).toBe(1);
    expect(errors.dequeue()?.message).toBe('processor.processBatch is not a function');
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
      name: 'mock',
      processBatch: jest.fn(),
    });

    batcher.addProcessor({
      name: 'mock',
      processBatch: jest.fn(),
    });

    expect(consoleSpy).toHaveBeenCalledWith('Processor mock already exists');
    consoleSpy.mockRestore();
  });

  it('should process messages on interval', async () => {
    const mockProcessor = {
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
      name: 'failing1',
      processBatch: jest.fn().mockRejectedValue(error1),
    };

    const failingProcessor2 = {
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

    const errors = await batcher.flush();
    expect(errors.size).toBe(2);
    const errorArray = errors.toArray();
    expect(errorArray).toContainEqual(error1);
    expect(errorArray).toContainEqual(error2);
  });

  it('should handle errors during destroy', async () => {
    const error = new Error('Process error');
    const failingProcessor = {
      name: 'failing',
      processBatch: jest.fn().mockRejectedValue(error),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // const consoleSpy = jest.spyOn(console, 'error');
    batcher.addProcessor(failingProcessor);
    batcher.info('test message');

    // Force immediate processing
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const errors = await batcher.flush();
    await batcher.destroy();

    expect(errors.size).toBe(1);
    expect(errors.dequeue()?.message).toBe('Process error');
  }, 10000); // Increase timeout
});

describe('Message Classification', () => {
  let batcher: MessageBatcher;
  let processedMessages: Queue<Message>;
  let mockProcessor: MessageProcessor;

  beforeEach(() => {
    processedMessages = new Queue<Message>();
    mockProcessor = {
      name: 'mock',
      processBatch: jest.fn((messages) => {
        messages.forEach(msg => processedMessages.enqueue(msg));
      }),
    };

    // Clear any existing patterns
    addErrorPatterns([
      {
        name: 'test',
        pattern: /test error/i,
        category: 'TEST_ERROR',
        severity: 'low',
        aggregation: {
          windowMs: 1000,
          countThreshold: 2,
        },
      },
    ]);
  });

  it('should aggregate similar messages in a batch', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);

    // Queue similar messages
    batcher.error('test error 1');
    batcher.error('test error 2');
    batcher.error('test error 3');
    
    await batcher.flush();

    // Should be aggregated into one message
    expect(processedMessages.size).toBe(1);
    const message = processedMessages.dequeue();
    expect(message?.[1]).toBe('[AGGREGATED] 3 similar TEST_ERROR messages in last 2s');
  });

  it('should not aggregate different message types', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);

    // Queue different types of messages
    batcher.error('test error');
    batcher.info('test info');
    batcher.warning('test warning');
    
    await batcher.flush();

    // Should not be aggregated
    expect(processedMessages.size).toBe(3);
  });

  it('should handle mixed message types correctly', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);

    // Queue mixed message types
    batcher.error('test error 1');
    batcher.info('random info');
    batcher.error('test error 2');
    batcher.warning('random warning');
    batcher.error('test error 3');
    
    await batcher.flush();

    // Should have 3 messages: 1 aggregated error + 1 info + 1 warning
    expect(processedMessages.size).toBe(3);
    
    const messages = processedMessages.toArray();
    const errorCount = messages.filter(m => m[2] === 'error').length;
    const infoCount = messages.filter(m => m[2] === 'info').length;
    const warningCount = messages.filter(m => m[2] === 'warning').length;
    
    expect(errorCount).toBe(1); // Aggregated errors
    expect(infoCount).toBe(1);
    expect(warningCount).toBe(1);
  });
});
