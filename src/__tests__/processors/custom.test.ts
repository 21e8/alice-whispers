import { createCustomProcessor } from '../../processors/custom';
import type { Message } from '../../types';

describe('createCustomProcessor', () => {
  it('should create a processor with processBatch', async () => {
    const processBatchMock = jest.fn();
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: processBatchMock,
    });

    const messages: Message[] = [['default', 'test', 'info']];
    await processor.processBatch(messages);

    expect(processBatchMock).toHaveBeenCalledWith([
      ['default', 'test', 'info', undefined],
    ]);
    expect(processor.name).toBe('test');
  });

  it('should handle errors in processBatch', async () => {
    const error = new Error('Test error');
    const processor = createCustomProcessor({
      name: 'test',
      processBatch: async () => {
        throw error;
      },
    });

    const messages: Message[] = [['default', 'test', 'info']];
    await expect(processor.processBatch(messages)).rejects.toThrow(error);
  });
});
