export * from './types';

export { TelegramProcessor } from './processors/telegram';
export type { TelegramConfig } from './types';

export { SlackProcessor } from './processors/slack';
export type { SlackConfig } from './processors/slack';

export { DiscordProcessor } from './processors/discord';
export type { DiscordConfig } from './processors/discord';

export { EmailProcessor } from './processors/email';
export type { EmailConfig } from './processors/email';

export { ConsoleProcessor } from './processors/console';

export { createMessageBatcher } from './batcher';
export type {
  Message,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor,
  IMessageBatcher,
} from './types';
