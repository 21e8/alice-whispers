export * from './types';

export { createTelegramProcessor } from './processors/telegram';
export type { TelegramConfig } from './types';

// export { createSlackProcessor } from './processors/slack';
// export type { SlackConfig } from './processors/slack';

// export { createDiscordProcessor } from './processors/discord';
// export type { DiscordConfig } from './processors/discord';

// export { createEmailProcessor } from './processors/email';
// export type { EmailConfig } from './processors/email';

export { createConsoleProcessor } from './processors/console';

export { createMessageBatcher } from './batcher';
export type {
  Message,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor,
  MessageBatcher as IMessageBatcher,
} from './types';
