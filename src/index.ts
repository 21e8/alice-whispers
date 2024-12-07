// import fetch from 'node-fetch';

export { MessageBatcher } from './batcher';
export { TelegramProcessor as TelegramBatcher } from './telegram';
export type {
  Message,
  BatcherConfig,
  NotificationLevel,
  MessageProcessor
} from './types';
