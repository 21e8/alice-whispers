export * from './types';

export { createTelegramProcessor } from './processors/telegram';
export type { TelegramConfig, ErrorPatternConfig, ErrorPattern } from './types';

export { createCustomProcessor } from './processors/custom';

export { createConsoleProcessor } from './processors/console';

export {
  addErrorPatterns,
  resetErrorPatterns,
  classifyError,
} from './utils/errorClassifier';

export { createMessageBatcher } from './batcher';
export type {
  Message,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor,
  MessageBatcher,
} from './types';
