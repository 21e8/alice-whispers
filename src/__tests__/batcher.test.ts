import { MessageBatcher } from '../batcher';
import sinon from 'sinon';
import { type Message } from '../types';

describe('MessageBatcher', () => {
  let clock: sinon.SinonFakeTimers;
  
  beforeEach(() => {
    // Setup fake timer
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    // Restore timer
    clock.restore();
  });

  it('should batch messages within the time window', async () => {
    const processBatchMock = sinon.spy();
    const batcher = new MessageBatcher({
      maxBatchSize: 3,
      maxWaitMs: 1000,
      processBatch: processBatchMock,
    });

    const messages: Message[] = [
      { chatId: '123', text: 'test1' },
      { chatId: '123', text: 'test2' },
      { chatId: '123', text: 'test3' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.addMessage(msg);
    }

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify the batch was processed
    sinon.assert.calledOnce(processBatchMock);
    sinon.assert.calledWith(processBatchMock, messages);
  });

  it('should process batch when max size is reached', async () => {
    const processBatchMock = sinon.spy();
    const batcher = new MessageBatcher({
      maxBatchSize: 2,
      maxWaitMs: 1000,
      processBatch: processBatchMock,
    });

    const messages: Message[] = [
      { chatId: '123', text: 'test1' },
      { chatId: '123', text: 'test2' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.addMessage(msg);
    }

    // Verify batch was processed immediately
    sinon.assert.calledOnce(processBatchMock);
    sinon.assert.calledWith(processBatchMock, messages);
  });

  it('should handle empty queue gracefully', async () => {
    const processBatchMock = sinon.spy();
    const batcher = new MessageBatcher({
      maxBatchSize: 3,
      maxWaitMs: 1000,
      processBatch: processBatchMock,
    });

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify no processing occurred
    sinon.assert.notCalled(processBatchMock);
  });

  it('should process messages for different chat IDs separately', async () => {
    const processBatchMock = sinon.spy();
    const batcher = new MessageBatcher({
      maxBatchSize: 3,
      maxWaitMs: 1000,
      processBatch: processBatchMock,
    });

    const messages: Message[] = [
      { chatId: '123', text: 'test1' },
      { chatId: '456', text: 'test2' },
      { chatId: '123', text: 'test3' },
    ];

    // Add messages to queue
    for (const msg of messages) {
      batcher.addMessage(msg);
    }

    // Fast forward time
    await clock.tickAsync(1000);

    // Verify batches were processed by chat ID
    sinon.assert.calledTwice(processBatchMock);
    const calls = processBatchMock.getCalls();
    expect(calls[0].args[0]).toEqual([
      { chatId: '123', text: 'test1' },
      { chatId: '123', text: 'test3' },
    ]);
    expect(calls[1].args[0]).toEqual([
      { chatId: '456', text: 'test2' },
    ]);
  });
}); 