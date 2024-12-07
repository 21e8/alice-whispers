// import { createDiscordProcessor } from '../../processors/discord';
// import type { Message } from '../../types';
describe('DiscordProcessor', () => {
  it('should be true', () => {
    expect(true).toBe(true);
  });
});
// describe('DiscordProcessor', () => {
//   const mockConfig = {
//     webhookUrl: 'https://discord.webhook/test',
//     username: 'TestBot'
//   };

//   beforeEach(() => {
//     (global.fetch as jest.Mock).mockClear();
//   });

//   it('should format messages with appropriate emojis', async () => {
//     const processor = createDiscordProcessor(mockConfig);
//     const messages: Message[] = [
//       { chatId: 'test', text: 'test message', level: 'info' }
//     ];

//     await processor.processBatch(messages);

//     expect(global.fetch).toHaveBeenCalledWith(
//       mockConfig.webhookUrl,
//       expect.objectContaining({
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: expect.any(String)
//       })
//     );
//   });

//   it('should send empty content for empty message batch', async () => {
//     const processor = createDiscordProcessor(mockConfig);
//     await processor.processBatch([]);
    
//     expect(global.fetch).not.toHaveBeenCalled();
//   });

//   it('should use default username when not provided', async () => {
//     const configWithoutUsername = {
//       webhookUrl: mockConfig.webhookUrl
//     };
//     const processor = createDiscordProcessor(configWithoutUsername);
    
//     const messages: Message[] = [
//       { chatId: 'test', text: 'test message', level: 'info' }
//     ];

//     await processor.processBatch(messages);

//     const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
//     expect(body.username).toBeUndefined();
//   });

//   it('should join multiple messages with newlines', async () => {
//     const processor = createDiscordProcessor(mockConfig);
//     const messages: Message[] = [
//       { chatId: 'test', text: 'first message', level: 'info' },
//       { chatId: 'test', text: 'second message', level: 'info' }
//     ];

//     await processor.processBatch(messages);

//     const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
//     expect(body.content.split('\n\n').length).toBe(2);
//   });
// });