import {
  createMessageBatcher,
  resetBatcher,
  globalQueues,
  timers,
} from '../batcher';
import type { Message, MessageBatcher, MessageProcessor } from '../types';

// // Import the internal queue for testing
// import { globalQueues } from '../batcher';

// // Import internal timers map for testing
// import { timers } from '../batcher';

describe('MessageBatcher', () => {
  let mockProcessor: MessageProcessor;
  let processedMessages: Message[];
  let setTimeoutSpy: jest.SpyInstance;
  let batcher: MessageBatcher;

  beforeEach(() => {
    processedMessages = [];
    mockProcessor = {
      processBatch: jest.fn(async (messages) => {
        processedMessages = messages;
      }),
    };
    setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (batcher) {
      batcher.destroy();
    }
    jest.clearAllMocks();
    jest.useRealTimers();
    resetBatcher();
  });
  it('should set a timer and process messages after the specified delay', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const processBatchSpy = jest.fn();

    // Clear any existing queues
    resetBatcher();

    // Verify queue doesn't exist yet
    expect(globalQueues.has('default')).toBe(false);

    batcher = createMessageBatcher(
      [
        mockProcessor,
        {
          processBatch: processBatchSpy,
        },
      ],
      {
        maxBatchSize: 5,
        maxWaitMs: 100,
      }
    );

    // Add a message
    batcher.info('test message');

    // Verify queue was initialized
    expect(globalQueues.has('default')).toBe(true);
    expect(globalQueues.get('default')).toHaveLength(1);

    // Verify that setTimeout was called to add a timer
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);
    // expect(processBatchSpy).toHaveBeenCalled();

    // Fast-forward time to trigger the timer
    jest.advanceTimersByTime(100);
    await Promise.resolve();

    // Verify the message was processed
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });
  it('should set a timer and process messages after the specified delay', async () => {
    jest.useRealTimers();
    const processBatchSpy = jest.fn();

    // Clear any existing queues
    resetBatcher();

    // Verify queue doesn't exist yet
    expect(globalQueues.has('default')).toBe(false);

    batcher = createMessageBatcher(
      [
        mockProcessor,
        {
          processBatch: processBatchSpy,
        },
      ],
      {
        maxBatchSize: 5,
        maxWaitMs: 100,
      }
    );

    // Add a message
    batcher.info('test message');

    // Verify queue was initialized
    expect(globalQueues.has('default')).toBe(true);
    expect(globalQueues.get('default')).toHaveLength(1);

    // Wait for the timer to expire
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify the message was processed by both processors
    expect(processBatchSpy).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);

    setTimeoutSpy.mockRestore();
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
    expect(processBatchSpy).toHaveBeenNthCalledWith(1, [
      {
        chatId: 'default',
        text: 'Message 1',
        level: 'info',
        error: undefined,
      },
    ]);
    expect(processBatchSpy).toHaveBeenNthCalledWith(2, [
      {
        chatId: 'default',
        text: 'Message 2',
        level: 'info',
        error: undefined,
      },
    ]);
  });

  it('should handle processor errors during sync flush', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const processBatchSpy = jest.fn(() =>
      Promise.reject(new Error('Process failed'))
    );
    const failingProcessor = { processBatch: processBatchSpy };

    batcher = createMessageBatcher([failingProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    batcher.info('Test message');
    batcher.flushSync();

    expect(processBatchSpy).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'Test message',
        level: 'info',
        error: undefined,
      },
    ]);

    // Wait for the next tick to ensure error is logged
    setImmediate(() => {
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  it('should handle undefined queue gracefully in sync mode', () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Call flushSync with no messages
    batcher.flushSync();
    expect(mockProcessor.processBatch).not.toHaveBeenCalled();
  });

  it('should handle sync processor errors without breaking the queue', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const syncProcessor = {
      processBatch: jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      }),
    };

    batcher = createMessageBatcher([syncProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    batcher.info('Test message');
    batcher.flushSync();

    expect(syncProcessor.processBatch).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor failed:',
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it('should initialize queue for new chat ID', async () => {
    // Reset the global queue to ensure we start fresh
    resetBatcher();

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Direct call to queueMessage to test queue initialization
    (batcher as any).queueMessage('test message', 'info');

    // Force immediate processing
    await batcher.flush();

    // Verify message was processed, indicating queue was initialized
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);
  });

  it('should initialize empty queue for new chat ID', () => {
    resetBatcher();

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Access the internal queue map
    const queues = globalQueues as Map<string, Message[]>;
    expect(queues.has('default')).toBe(false);

    // This should initialize the queue
    (batcher as any).queueMessage('test message', 'info');

    // Verify queue was initialized
    expect(queues.has('default')).toBe(true);
    expect(queues.get('default')).toHaveLength(1);
    expect(queues.get('default')?.[0]).toEqual({
      chatId: 'default',
      text: 'test message',
      level: 'info',
      error: undefined,
    });
  });

  it('should initialize queue when it does not exist', () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Verify queue doesn't exist initially
    expect(globalQueues.has('default')).toBe(false);

    // Add a message which should initialize the queue
    (batcher as any).queueMessage('test message', 'info');

    // Verify queue was initialized with the message
    expect(globalQueues.has('default')).toBe(true);
    const queue = globalQueues.get('default');
    expect(queue).toBeDefined();
    expect(queue).toEqual([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);
  });

  it('should handle undefined queue result from get', async () => {
    // Clear any existing queues
    globalQueues.clear();

    // Create a new batcher
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Force the queue to be undefined for the first get
    const queue = globalQueues.get('default');
    expect(queue).toBeUndefined();

    // Add a message - this should handle the undefined case
    (batcher as any).queueMessage('test message', 'info');

    // Process immediately
    await batcher.flush();

    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);
  });

  it('should set up new timer when none exists', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Add a message (should create a timer)
    (batcher as any).queueMessage('test message', 'info');

    // Verify timer was created
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    // Advance time to trigger the timer
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Verify message was processed
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should not create new timer if one exists', async () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Add first message (should create a timer)
    (batcher as any).queueMessage('message 1', 'info');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    // Reset the spy to check if another timer is created
    setTimeoutSpy.mockClear();

    // Add second message (should not create a new timer)
    (batcher as any).queueMessage('message 2', 'info');
    expect(setTimeoutSpy).not.toHaveBeenCalled();

    // Advance time to trigger the timer
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Verify both messages were processed together
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'message 1',
        level: 'info',
        error: undefined,
      },
      {
        chatId: 'default',
        text: 'message 2',
        level: 'info',
        error: undefined,
      },
    ]);

    setTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it('should clean up timer after processing', async () => {
    jest.useFakeTimers();

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Add a message (should create a timer)
    (batcher as any).queueMessage('test message', 'info');

    // Verify timer was created
    expect(timers.size).toBe(1);

    // Advance time to trigger the timer
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Verify timer was cleaned up
    expect(timers.size).toBe(0);

    // Verify message was processed
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);

    jest.useRealTimers();
  });

  it('should execute timer callback and delete timer', async () => {
    jest.useFakeTimers();

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 1000,
    });

    // Add a message (should create a timer)
    (batcher as any).queueMessage('test message', 'info');

    // Get the timer ID
    const timerIds = Array.from(timers.values());
    expect(timerIds).toHaveLength(1);

    // Advance time to trigger the callback
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    // Verify timer was deleted
    expect(timers.has('default')).toBe(false);
    expect(timers.size).toBe(0);
    // Add another message to verify new timer can be created
    (batcher as any).queueMessage('test message 2', 'info');
    expect(timers.size).toBe(1);

    jest.useRealTimers();
  });
});
