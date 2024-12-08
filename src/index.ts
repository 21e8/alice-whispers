export * from './types';

export { createTelegramProcessor } from './processors/telegram';
export type { TelegramConfig } from './types';

export { createCustomProcessor } from './processors/custom';

export { createConsoleProcessor } from './processors/console';

export {
  addErrorPatterns,
  resetErrorPatterns,
  type ErrorPatternConfig,
  classifyError,
} from './utils/errorClassifier';

export { createMessageBatcher } from './batcher';
export type {
  Message,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor,
  MessageBatcher as IMessageBatcher,
} from './types';
