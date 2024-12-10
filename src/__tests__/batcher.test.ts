/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createMessageBatcher, globalBatchers } from '../batcher';
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

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    // Clean up any existing batchers
    for (const [id, existingBatcher] of globalBatchers) {
      try {
        await existingBatcher.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
      globalBatchers.delete(id);
    }
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
      try {
        await batcher.destroy();
      } catch (error) {
        // Ignore cleanup errors
      }
      globalBatchers.delete('default');
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
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
      // fail('Expected BatchAggregateError to be thrown');
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
    expect(errors.dequeue()?.message).toBe(
      'processor.processBatch is not a function'
    );
  });

  it('should handle multiple concurrent processors with different speeds', async () => {
    jest.useFakeTimers();
    
    const slowProcessor = {
      name: 'slow',
      processBatch: jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }),
    };

    const fastProcessor = {
      name: 'fast',
      processBatch: jest.fn(async () => {
        await Promise.resolve();
      }),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2,
      singleton: false,
    });

    batcher.addProcessor(slowProcessor);
    batcher.addProcessor(fastProcessor);
    batcher.info('test message');

    // Advance timers and handle all pending promises
    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Handle microtasks
    
    // Run flush and advance timers for slow processor
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
    jest.useFakeTimers();
    
    const error1 = new Error('Process error 1');
    const error2 = new Error('Process error 2');
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
      singleton: false,
    });

    batcher.addProcessor(failingProcessor1);
    batcher.addProcessor(failingProcessor2);
    batcher.info('test message');

    // Advance timer to trigger processing
    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Handle microtasks

    try {
      await batcher.flush();
    } catch (error) {
      expect(error).toBeInstanceOf(BatchAggregateError);
      const batchError = error as BatchAggregateError;
      expect(batchError.errors.size).toBe(2);
      const errorArray = batchError.errors.toArray();
      expect(errorArray).toContainEqual(error1);
      expect(errorArray).toContainEqual(error2);
    }
  });

  it('should handle errors during destroy', async () => {
    jest.useFakeTimers();
    
    const error = new Error('Process error');
    const failingProcessor = {
      name: 'failing',
      processBatch: jest.fn().mockRejectedValue(error),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      processors: [failingProcessor],
      singleton: false,
    });

    batcher.info('test message');
    
    // Advance timer to trigger processing
    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Handle microtasks

    const errors = await batcher.destroy();
    expect(errors.size).toBe(1);
    expect(errors.dequeue()?.message).toBe('Process error');
    
    jest.useRealTimers();
  });
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
        messages.forEach((msg) => processedMessages.enqueue(msg));
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

  afterEach(async () => {
    if (batcher) {
      await batcher.destroy();
      globalBatchers.delete('default');
    }
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
    expect(message?.[1]).toBe(
      '[AGGREGATED] 3 similar TEST_ERROR messages in last 2s'
    );
  });

  it('should not aggregate different message types', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: false,
    });

    batcher.addProcessor(mockProcessor);

    // Queue different types of messages
    batcher.error('test error');
    batcher.info('test info');
    batcher.warning('test warning');

    // Wait for messages to be processed
    await batcher.flush();

    // Should not be aggregated
    expect(processedMessages.size).toBe(3);
  });

  it('should handle mixed message types correctly', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    addErrorPatterns([
      {
        name: 'test',
        pattern: /test error/i,
        category: 'TEST_ERROR',
        severity: 'low',
      },
    ]);

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
    const errorCount = messages.filter((m) => m[2] === 'error').length;
    const infoCount = messages.filter((m) => m[2] === 'info').length;
    const warningCount = messages.filter((m) => m[2] === 'warning').length;

    expect(errorCount).toBe(1); // Aggregated errors
    expect(infoCount).toBe(1);
    expect(warningCount).toBe(1);
  });
});

describe('Batcher Initialization and Singleton', () => {
  // let mockProcessor: MessageProcessor;
  let batcher1: MessageBatcher;
  let batcher2: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    // mockProcessor = {
    //   name: 'mock',
    //   processBatch: jest.fn(),
    // };
  });

  afterEach(async () => {
    if (batcher1) await batcher1.destroy();
    if (batcher2) await batcher2.destroy();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should warn when creating multiple batchers', () => {
    const consoleSpy = jest.spyOn(console, 'warn');

    batcher1 = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      id: 'test',
    });

    batcher2 = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      id: 'test2',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'You are trying to create a new batcher while there is already one. This is currently not supported. Be at your own risk.'
    );
    consoleSpy.mockRestore();
  });

  it('should return existing batcher when singleton is true', () => {
    batcher1 = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      id: 'test',
      singleton: true,
    });

    batcher2 = createMessageBatcher({
      maxBatchSize: 10, // Different config
      maxWaitMs: 200,
      id: 'test',
      singleton: true,
    });

    // Should be the same instance
    expect(batcher1).toBe(batcher2);
  });

  it('should create new batcher when singleton is false', () => {
    batcher1 = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      id: 'test',
      singleton: false,
    });

    batcher2 = createMessageBatcher({
      maxBatchSize: 10,
      maxWaitMs: 200,
      id: 'test',
      singleton: false,
    });

    // Should be different instances
    expect(batcher1).not.toBe(batcher2);
  });
});

describe('Queue and Timer Behavior', () => {
  let mockProcessor: MessageProcessor;
  let batcher: MessageBatcher;

  beforeEach(async () => {
    jest.useFakeTimers();
    mockProcessor = {
      name: 'mock',
      processBatch: jest.fn(),
    };
    // Ensure any existing batchers are cleaned up
    const existingBatcher = globalBatchers.get('default');
    if (existingBatcher) {
      await existingBatcher.destroy();
      globalBatchers.delete('default');
    }
  });

  afterEach(async () => {
    if (batcher) {
      await batcher.destroy();
      globalBatchers.delete('default');
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should create new queue for first message', () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: false, // Ensure we get a fresh instance
    });

    expect(batcher.queues.size).toBe(0);
    batcher.queueMessage('test', 'info');
    expect(batcher.queues.size).toBe(1);
    expect(batcher.queues.get('default')?.size).toBe(1);
  });

  it('should create timer for first message', () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    expect(batcher.timers.size).toBe(0);
    batcher.queueMessage('test', 'info');
    expect(batcher.timers.size).toBe(1);
  });

  it('should process messages when timer expires', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(mockProcessor);
    batcher.queueMessage('test', 'info');

    // Timer hasn't expired yet
    expect(mockProcessor.processBatch).not.toHaveBeenCalled();

    // Advance timer
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    expect(mockProcessor.processBatch).toHaveBeenCalled();
  });
});

describe('Concurrent Processing Edge Cases', () => {
  // let mockProcessor: MessageProcessor;
  let batcher: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    // mockProcessor = {
    //   name: 'mock',
    //   processBatch: jest.fn(),
    // };
  });

  afterEach(async () => {
    if (batcher) await batcher.destroy();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should handle processor throwing non-Error', async () => {
    const throwingProcessor = {
      name: 'throwing',
      processBatch: jest.fn().mockRejectedValue('string error'),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      processors: [throwingProcessor],
    });

    batcher.info('test');

    const errors = await batcher.flush();
    expect(errors.size).toBe(1);
    const dequeued = errors.dequeue();
    expect(dequeued?.message).toBe('string error');
  });

  it('should handle processor returning invalid value', async () => {
    const invalidProcessor = {
      name: 'invalid',
      processBatch: jest.fn().mockResolvedValue('not void'),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addProcessor(invalidProcessor);
    batcher.info('test');

    const errors = await batcher.flush();
    expect(errors.size).toBe(0); // Should not error on invalid return
  });
});

describe('Flush and Destroy Behavior', () => {
  // let mockProcessor: MessageProcessor;
  let batcher: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    // mockProcessor = {
    //   name: 'mock',
    //   processBatch: jest.fn(),
    // };
  });

  afterEach(async () => {
    if (batcher) await batcher.destroy();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should clear timers on destroy', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.info('test');
    expect(batcher.timers.size).toBe(1);

    await batcher.destroy();
    expect(batcher.timers.size).toBe(0);
  });

  it('should clear queues on destroy', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.info('test');
    expect(batcher.queues.size).toBe(1);

    await batcher.destroy();
    expect(batcher.queues.size).toBe(0);
  });

  it('should handle destroy with pending messages', async () => {
    const slowProcessor = {
      name: 'slow',
      processBatch: jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }),
    };

    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: false,
    });

    batcher.addProcessor(slowProcessor);
    batcher.info('test');

    // Start destroy and advance timers for both the queue timer and the slow processor
    const destroyPromise = batcher.destroy();
    jest.advanceTimersByTime(100); // Queue timer
    await Promise.resolve(); // Handle microtasks
    jest.advanceTimersByTime(1000); // Slow processor
    await destroyPromise;

    expect(slowProcessor.processBatch).toHaveBeenCalled();
  });

  it('should handle flush with no messages', async () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const errors = await batcher.flush();
    expect(errors.size).toBe(0);
  });

  it('should handle flushSync with no messages', () => {
    batcher = createMessageBatcher({
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    expect(() => batcher.flushSync()).not.toThrow();
  });

  // it('should handle BatchAggregateError during destroy', async () => {
  //   const error = new Error('Process error');
  //   const failingProcessor = {
  //     name: 'failing',
  //     processBatch: jest.fn().mockRejectedValue(error),
  //   };

  //   batcher = createMessageBatcher({
  //     maxBatchSize: 5,
  //     maxWaitMs: 100,
  //   });

  //   const consoleSpy = jest
  //     .spyOn(console, 'error')
  //     .mockImplementation(() => {});
  //   batcher.addProcessor(failingProcessor);
  //   batcher.info('test message');

  //   // Force immediate processing
  //   // eslint-disable-next-line @typescript-eslint/no-empty-function
  //   const errors = await batcher.flush();
  //   await batcher.destroy();

  //   expect(errors.size).toBe(1);
  //   expect(errors.dequeue()?.message).toBe('Process error');
  //   consoleSpy.mockRestore();
  // }, 10000); // Increase timeout
});
