export * from './types';

export { createTelegramProcessor } from './processors/telegram';
export type { TelegramConfig } from './types';

export { createConsoleProcessor } from './processors/console';

export { addErrorPatterns, resetErrorPatterns } from './utils/errorClassifier';

export { createMessageBatcher } from './batcher';
export type {
  Message,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor,
  MessageBatcher as IMessageBatcher,
} from './types';
