import { MessageBatcher } from '../batcher';
// import { TelegramBatcher } from '../telegram';
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
      processBatch: processBatchSpy
    };
  });

  afterEach(() => {
    clock.restore();
  });

  it('should batch messages within the time window', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000
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
      maxWaitMs: 1000
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
      maxWaitMs: 1000
    });

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify no processing occurred
    sinon.assert.notCalled(processBatchSpy);
  });

  it('should batch all messages together', async () => {
    const batcher = new MessageBatcher([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000
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
      processBatch: sinon.spy()
    };

    const batcher = new MessageBatcher([mockProcessor, mockProcessor2], {
      maxBatchSize: 2,
      maxWaitMs: 1000
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
      maxWaitMs: 1000
    });

    batcher.queueMessage('test', 'info');
    batcher.destroy();

    // Fast forward time
    clock.tick(1000);

    // Verify no processing occurred after destroy
    sinon.assert.notCalled(processBatchSpy);
  });
}); 