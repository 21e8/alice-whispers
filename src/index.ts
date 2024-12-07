// import fetch from 'node-fetch';

export * from './types';

export * from './processors/telegram';
export type { TelegramConfig } from './types';

export * from './processors/slack';
export type { SlackConfig } from './processors/slack';

export * from './processors/discord';
export type { DiscordConfig } from './processors/discord';

export * from './processors/email';
export type { EmailConfig } from './processors/email';

export * from './processors/console';

export { MessageBatcher } from './batcher';
