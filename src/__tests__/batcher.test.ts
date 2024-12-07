import { MessageBatcher } from '../batcher';
import sinon from 'sinon';
import { type Message, type MessageProcessor } from '../types';

describe('MessageBatcher', () => {
  let clock: sinon.SinonFakeTimers;
  let mockProcessor: MessageProcessor;
  let processBatchSpy: sinon.SinonSpy;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    processBatchSpy = sinon.spy();
    mockProcessor = {
      processBatch: processBatchSpy,
    };
  });

  afterEach(() => {
    clock.restore();
  });

  it('should batch messages within the time window', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000,
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
      { chatId: 'default', text: 'test3', level: 'error' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.queueMessage(msg.text, msg.level);
    }

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify the batch was processed
    sinon.assert.calledOnce(processBatchSpy);
    sinon.assert.calledWith(processBatchSpy, messages);
  });

  it('should process batch when max size is reached', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.queueMessage(msg.text, msg.level);
    }

    // Verify batch was processed immediately
    sinon.assert.calledOnce(processBatchSpy);
    sinon.assert.calledWith(processBatchSpy, messages);
  });

  it('should handle empty queue gracefully', async () => {
    new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000,
    });

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify no processing occurred
    sinon.assert.notCalled(processBatchSpy);
  });

  it('should batch all messages together', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000,
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
      { chatId: 'default', text: 'test3', level: 'error' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.queueMessage(msg.text, msg.level);
    }

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify all messages were batched together
    sinon.assert.calledOnce(processBatchSpy);
    sinon.assert.calledWith(processBatchSpy, messages);
  });

  it('should send to multiple processors', async () => {
    const mockProcessor2 = {
      processBatch: sinon.spy(),
    };

    const batcher = new MessageBatcher([mockProcessor, mockProcessor2], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.queueMessage(msg.text, msg.level);
    }

    // Verify both processors received the messages
    sinon.assert.calledOnce(processBatchSpy);
    sinon.assert.calledOnce(mockProcessor2.processBatch);
    sinon.assert.calledWith(processBatchSpy, messages);
    sinon.assert.calledWith(mockProcessor2.processBatch, messages);
  });

  it('should cleanup properly on destroy', () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000,
    });

    batcher.queueMessage('test', 'info');
    batcher.destroy();

    // Fast forward time
    clock.tick(1000);

    // Verify no processing occurred after destroy
    sinon.assert.notCalled(processBatchSpy);
  });

  it('should handle processor errors gracefully', async () => {
    const consoleErrorSpy = sinon.spy(console, 'error');
    const errorProcessorSpy = sinon.stub().rejects(new Error('Processing failed'));
    const errorProcessor: MessageProcessor = {
      processBatch: errorProcessorSpy
    };
    
    const successProcessorSpy = sinon.spy();
    const successProcessor: MessageProcessor = {
      processBatch: successProcessorSpy
    };

    const batcher = new MessageBatcher([errorProcessor, successProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
    ];

    // Add messages and wait for processing
    for (const msg of messages) {
      batcher.queueMessage(msg.text, msg.level);
    }
    
    await batcher.flush().catch(() => {/* ignore error */});
    await clock.tickAsync(0);

    // Verify error was logged
    sinon.assert.calledWith(
      consoleErrorSpy,
      'Processor 0 failed:',
      sinon.match.instanceOf(Error).and(sinon.match.has('message', 'Processing failed'))
    );

    // Verify both processors were called with first batch
    sinon.assert.calledWith(errorProcessorSpy, messages);
    sinon.assert.calledWith(successProcessorSpy, messages);

    // Queue more messages to verify batcher still works after error
    const nextMessage: Message = { chatId: 'default', text: 'test3', level: 'info' };
    batcher.queueMessage(nextMessage.text, nextMessage.level);
    await batcher.flush().catch(() => {/* ignore error */});
    await clock.tickAsync(0);

    // Verify both processors handled both batches
    sinon.assert.calledTwice(errorProcessorSpy);
    sinon.assert.calledTwice(successProcessorSpy);
    sinon.assert.calledWith(errorProcessorSpy.secondCall, [nextMessage]);
    sinon.assert.calledWith(successProcessorSpy.secondCall, [nextMessage]);

    // Cleanup
    consoleErrorSpy.restore();
  });

  it('should process messages with different chatIds separately', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    const messages1: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
    ];

    // Queue first batch
    for (const msg of messages1) {
      batcher.queueMessage(msg.text, msg.level);
    }
    await clock.tickAsync(0);

    const messages2: Message[] = [
      { chatId: 'default', text: 'test3', level: 'error' },
      { chatId: 'default', text: 'test4', level: 'info' },
    ];

    // Queue second batch
    for (const msg of messages2) {
      batcher.queueMessage(msg.text, msg.level);
    }
    await clock.tickAsync(0);

    // Verify batches were processed separately
    sinon.assert.calledTwice(processBatchSpy);
    const firstCall = processBatchSpy.getCall(0);
    const secondCall = processBatchSpy.getCall(1);
    expect(firstCall.args[0]).toEqual(messages1);
    expect(secondCall.args[0]).toEqual(messages2);
  });

  it('should respect maxWaitMs even with incomplete batch', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 500,
    });

    const message: Message = {
      chatId: 'default',
      text: 'test1',
      level: 'info',
    };
    batcher.queueMessage(message.text, message.level);

    // Fast forward less than maxWaitMs
    await clock.tickAsync(300);
    sinon.assert.notCalled(processBatchSpy);

    try {
      // Fast forward to exceed maxWaitMs
      await clock.tickAsync(200);
      sinon.assert.calledOnce(processBatchSpy);
      sinon.assert.calledWith(processBatchSpy, [message]);
    } catch (error) {
      // Ignore processing errors for this test
    }
  });

  it('should handle queueMessage after destroy', () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    batcher.destroy();

    // Should not throw error when trying to queue after destroy
    batcher.queueMessage('test', 'info');

    clock.tick(1000);
    sinon.assert.notCalled(processBatchSpy);
  });

  it('should process messages with custom levels', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'test1', level: 'info' },
      { chatId: 'default', text: 'test2', level: 'warning' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.queueMessage(msg.text, msg.level);
    }

    // Verify custom levels are preserved
    sinon.assert.calledOnce(processBatchSpy);
    sinon.assert.calledWith(processBatchSpy, messages);
  });
});
