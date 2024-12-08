import { Message, MessageProcessor } from '../types';
import chalk from 'chalk';

export function createConsoleProcessor(): MessageProcessor {
  async function processBatch(messages: Message[]): Promise<void> {
    for (const msg of messages) {
      switch (msg.level) {
        case 'info':
          console.log(chalk.blue('ℹ'), msg.text);
          break;
        case 'warning':
          console.log(chalk.yellow('⚠'), msg.text);
          break;
        case 'error':
          console.log(chalk.red('🚨'), msg.text);
          break;
      }
    }
  }

  return { processBatch, name: 'console' };
}
