import { Message, MessageProcessor } from '../types';

export function createConsoleProcessor(): MessageProcessor {
  async function processBatch(messages: Message[]): Promise<void> {
    for (const msg of messages) {
      switch (msg[2]) {
        case 'info':
          console.log('ℹ', msg[1]);
          break;
        case 'warning':
          console.log('⚠', msg[1]);
          break;
        case 'error':
          console.log('🚨', msg[1], msg[3]);
          break;
      }
    }
  }

  return { processBatch, name: 'console' };
}
