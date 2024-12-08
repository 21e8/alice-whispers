import { Message, MessageProcessor } from '../types';
import chalk from 'chalk';

export function createConsoleProcessor(): MessageProcessor {
  async function processBatch(messages: Message[]): Promise<void> {
    for (const msg of messages) {
      switch (msg[2]) {
        case 'info':
          console.log(chalk.blue('ℹ'), msg[1]);
          break;
        case 'warning':
          console.log(chalk.yellow('⚠'), msg[1]);
          break;
        case 'error':
          console.log(chalk.red('🚨'), msg[1], msg[3]);
          break;
      }
    }
  }

  return { type: 'external', processBatch, name: 'console' };
}
