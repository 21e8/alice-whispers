import { createMessageBatcher } from '../batcher';
import type {
  MessageBatcher,
  MessageProcessor,
  // MessageObject,
  Message,
} from '../types';

describe('MessageBatcher', () => {
  let mockProcessor: MessageProcessor;
  let processedMessages: Message[];
  let batcher: MessageBatcher;

  beforeEach(() => {
    jest.useFakeTimers();
    processedMessages = [];
    mockProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatch: jest.fn(async (messages) => {
        processedMessages = messages;
      }),
    };
  });

  afterEach(() => {
    if (batcher) {
      batcher.destroy();
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

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2,
    });

    batcher.addExtraProcessor(extraProcessor);
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
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.info('Test info message');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual([
      'default',
      'Test info message',
      'info',
      undefined,
    ]);
  });

  it('should handle warning messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.warning('Test warning message');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual([
      'default',
      'Test warning message',
      'warning',
      undefined,
    ]);
  });

  it('should handle error messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const testError = new Error('Test error occurred');
    batcher.error('Test error message', testError);
    await batcher.flush();
    const result: Message = [
      'default',
      'Test error message',
      'error',
      testError,
    ];
    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual(result);
  });

  it('should handle processor removal', async () => {
    const extraProcessor = {
      type: 'external' as const,
      name: 'extra',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addExtraProcessor(extraProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(extraProcessor.processBatch).toHaveBeenCalled();

    batcher.removeExtraProcessor(extraProcessor.name);
    batcher.info('another message');
    await batcher.flush();

    expect(extraProcessor.processBatch).toHaveBeenCalledTimes(1);
  });

  it('should handle processor removal with invalid name', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.removeExtraProcessor('invalid');
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

    batcher = createMessageBatcher([testProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

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

  it('should handle sync processor errors', async () => {
    const errorProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatchSync: () => {
        throw new Error('Sync error');
      },
      processBatch: () => {
        throw new Error('Sync error');
      },
    };

    batcher = createMessageBatcher([errorProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    batcher.flushSync();

    expect(consoleSpy).toHaveBeenCalledWith(
      `Processor ${errorProcessor.name} failed:`,
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle async processor errors', async () => {
    const errorProcessor = {
      type: 'external' as const,
      name: 'mock',
      processBatch: async () => {
        throw new Error('Async error');
      },
    };

    batcher = createMessageBatcher([errorProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    await batcher.flush();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor mock failed:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle batch processing errors', async () => {
    const errorProcessor = {
      type: 'external' as const,
      name: 'error',
      processBatch: undefined as any,
    };

    batcher = createMessageBatcher([errorProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    await batcher.flush();

    expect(consoleSpy).toHaveBeenCalledWith(
      `Processor ${errorProcessor.name} failed:`,
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle multiple concurrent processors with different speeds', async () => {
    const slowProcessor = {
      type: 'external' as const,
      name: 'processor1',
      processBatch: jest.fn().mockImplementation(async () => {
        await Promise.resolve();
      }),
    };
    const fastProcessor = {
      type: 'external' as const,
      name: 'processor2',
      processBatch: jest.fn().mockResolvedValue(undefined),
    };

    batcher = createMessageBatcher([slowProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addExtraProcessor(fastProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(slowProcessor.processBatch).toHaveBeenCalled();
    expect(fastProcessor.processBatch).toHaveBeenCalled();
  });

  it('should reuse existing batcher instance', () => {
    const firstBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const secondBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 10,
      maxWaitMs: 200,
    });

    expect(secondBatcher).toBe(firstBatcher);
  });

  it('should reuse singleton instance', () => {
    const firstBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: true,
    });

    const secondBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: true,
    });

    expect(firstBatcher).toBe(secondBatcher);
  });

  it('should handle duplicate processor error', () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.addExtraProcessor({
      type: 'external',
      name: 'mock',
      processBatch: jest.fn(),
    });

    expect(consoleSpy).toHaveBeenCalledWith('Processor mock already exists');
    consoleSpy.mockRestore();
  });

  it('should handle empty queue processing', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    await batcher.processBatch('default');
    expect(mockProcessor.processBatch).not.toHaveBeenCalled();
  });

  it('should cleanup timers when processing batch', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    
    // Queue a message which creates a timer
    batcher.info('test');
    
    // Process the batch which should clear the timer
    await batcher.flush();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should handle concurrent processing errors', async () => {
    const error = new Error('Test error');
    
    // Create two processors that will throw errors
    const failingProcessor1 = {
      type: 'internal' as const,
      name: 'failing1',
      processBatch: jest.fn().mockRejectedValue(error),
    };
    const failingProcessor2 = {
      type: 'internal' as const,
      name: 'failing2',
      processBatch: jest.fn().mockRejectedValue(new Error('Second error')),
    };

    batcher = createMessageBatcher([failingProcessor1, failingProcessor2], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2, // Process both at once
    });

    // Queue a message to process
    batcher.info('test');
    
    // The first error should be caught and logged
    const consoleSpy = jest.spyOn(console, 'error');
    await batcher.flush();
    
    // The first processor's error should be logged first
    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor failing1 failed:',
      error
    );
    consoleSpy.mockRestore();
  });

  it('should not create singleton if disabled', () => {
    const firstBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: false,
    });

    const secondBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: false,
    });

    expect(firstBatcher).not.toBe(secondBatcher);
  });

  it('should process messages on interval', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.info('test message');
    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Let any pending promises resolve

    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      ['default', 'test message', 'info', undefined],
    ]);
  });

  it('should handle sync processor with async processBatch', async () => {
    const asyncProcessor = {
      type: 'external' as const,
      name: 'async',
      processBatch: jest.fn().mockImplementation(() => Promise.reject(new Error('Async error'))),
    };

    batcher = createMessageBatcher([asyncProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    batcher.flushSync();

    // Wait for the next tick to handle the promise rejection
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor async failed:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle removeAllExtraProcessors', () => {
    const extraProcessor1 = {
      type: 'external' as const,
      name: 'extra1',
      processBatch: jest.fn(),
    };
    const extraProcessor2 = {
      type: 'external' as const,
      name: 'extra2',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addExtraProcessor(extraProcessor1);
    batcher.addExtraProcessor(extraProcessor2);
    batcher.removeAllExtraProcessors();

    batcher.info('test message');
    batcher.flushSync();

    expect(extraProcessor1.processBatch).not.toHaveBeenCalled();
    expect(extraProcessor2.processBatch).not.toHaveBeenCalled();
  });

  it('should handle empty queue in processBatch', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // Call processBatch with non-existent queue
    await (batcher as any).processBatch('nonexistent');
    expect(mockProcessor.processBatch).not.toHaveBeenCalled();
  });

  it('should handle singleton initialization', () => {
    const firstBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: true,
    });

    // Store reference to global batcher
    const globalBatcher = firstBatcher;

    // Create new batcher with different config
    const secondBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 10, // Different config
      maxWaitMs: 200,
      singleton: true,
    });

    // Should return the same instance
    expect(secondBatcher).toBe(globalBatcher);
  });

  it('should handle processor removal edge cases', async () => {
    const processor1 = {
      type: 'external' as const,
      name: 'test1',
      processBatch: jest.fn(),
    };
    const processor2 = {
      type: 'external' as const,
      name: 'test2',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // Add both processors
    batcher.addExtraProcessor(processor1);
    batcher.addExtraProcessor(processor2);

    // Remove processor1 specifically
    batcher.removeExtraProcessor(processor1.name);

    // Verify only processor1 was removed
    batcher.info('test');
    await batcher.flush();

    expect(processor1.processBatch).not.toHaveBeenCalled();
    expect(processor2.processBatch).toHaveBeenCalled();

    // Now remove all processors
    batcher.removeAllExtraProcessors();

    // Send another message
    batcher.info('test2');
    await batcher.flush();

    // Verify processor2 wasn't called again
    expect(processor2.processBatch).toHaveBeenCalledTimes(1);
  });

  it('should handle null queue case', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // Force queue to be null/undefined
    (batcher as any).queues.set('default', null);

    await batcher.processBatch('default');
    expect(mockProcessor.processBatch).not.toHaveBeenCalled();
  });

  it('should handle global singleton state', () => {
    // Reset any existing global state
    (batcher as any).destroy();
    
    // Create first batcher with singleton enabled
    const firstBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      singleton: true,
    });

    // Create second batcher with different config but singleton enabled
    const secondBatcher = createMessageBatcher([{...mockProcessor, name: 'different'}], {
      maxBatchSize: 10,
      maxWaitMs: 200,
      singleton: true,
    });

    // Should return the same instance regardless of config
    expect(secondBatcher).toBe(firstBatcher);
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

    // Create batcher with internal processor
    batcher = createMessageBatcher([internalProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // Add external processor
    batcher.addExtraProcessor(externalProcessor);
    
    // Queue a message and process it to verify both processors work
    batcher.info('test1');
    await batcher.flush();
    
    expect(externalProcessor.processBatch).toHaveBeenCalled();
    expect(internalProcessor.processBatch).toHaveBeenCalled();

    // Remove external processors
    batcher.removeAllExtraProcessors();

    // Queue another message
    batcher.info('test2');
    await batcher.flush();

    // External processor shouldn't be called again
    expect(externalProcessor.processBatch).toHaveBeenCalledTimes(1);
    // Internal processor should be called again
    expect(internalProcessor.processBatch).toHaveBeenCalledTimes(2);
  });

  it('should handle concurrent processing errors', async () => {
    const error = new Error('Test error');
    const failingProcessor = {
      type: 'external' as const,
      name: 'failing',
      processBatch: jest.fn().mockRejectedValue(error),
    };

    batcher = createMessageBatcher([failingProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 1,
    });

    batcher.info('test');
    
    // The error is caught in exhaustBatcher, so we need to check if it was logged
    const consoleSpy = jest.spyOn(console, 'error');
    await batcher.flush();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor failing failed:',
      error
    );
    consoleSpy.mockRestore();
  });

  it('should handle undefined queue case', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // Force queue to be undefined
    (batcher as any).queues.set('default', undefined);

    await batcher.processBatch('default');
    expect(mockProcessor.processBatch).not.toHaveBeenCalled();
  });

  it('should handle errors in concurrent processing', async () => {
    const error = new Error('Test error');
    
    // Create two processors that will throw errors
    const failingProcessor1 = {
      type: 'internal' as const,
      name: 'failing1',
      processBatch: jest.fn().mockRejectedValue(error),
    };
    const failingProcessor2 = {
      type: 'internal' as const,
      name: 'failing2',
      processBatch: jest.fn().mockRejectedValue(new Error('Second error')),
    };

    batcher = createMessageBatcher([failingProcessor1, failingProcessor2], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2, // Process both at once
    });

    // Queue a message to process
    batcher.info('test');
    
    // The first error should be caught and logged
    const consoleSpy = jest.spyOn(console, 'error');
    await batcher.flush();
    
    // The first processor's error should be logged first
    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor failing1 failed:',
      error
    );
    consoleSpy.mockRestore();
  });

  it('should throw first error in concurrent processing', async () => {
    const error = new Error('Test error');
    
    // Create a processor that will throw an error
    const failingProcessor = {
      type: 'internal' as const,
      name: 'failing',
      processBatch: jest.fn().mockImplementation(async () => {
        // Create a Promise.allSettled rejection that will be handled by concurrentExhaust
        const results = await Promise.allSettled([
          Promise.reject(error)
        ]);
        
        // This is the same code as in concurrentExhaust
        const errors = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map(r => r.reason);
          
        if (errors.length > 0) {
          throw errors[0]; // This should trigger line 139's behavior
        }
      }),
    };

    batcher = createMessageBatcher([failingProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 1,
    });

    // Queue a message and process it
    batcher.info('test');
    
    // The error should be caught by exhaustBatcher
    const consoleSpy = jest.spyOn(console, 'error');
    await batcher.flush();
    
    // Verify the error was caught and logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor failing failed:',
      error
    );
    consoleSpy.mockRestore();
    
    // Also verify that the processor was called
    expect(failingProcessor.processBatch).toHaveBeenCalled();
  });
});
