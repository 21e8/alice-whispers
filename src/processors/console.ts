import { Message, MessageProcessor } from '../types';
import chalk from 'chalk';

export type ConsoleProcessorConstructor = {
  new (): ConsoleProcessor;
};

export class ConsoleProcessor implements MessageProcessor {
  async processBatch(messages: Message[]): Promise<void> {
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
} 