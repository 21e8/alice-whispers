export type NotificationLevel = 'info' | 'warning' | 'error';

export type Message = {
  chatId: string;
  text: string;
};

export type BatcherConfig = {
  maxBatchSize: number;
  maxWaitMs: number;
  processBatch: (messages: Message[]) => Promise<void> | void;
};

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  batchDelay?: number; // in ms, default 60000
  development?: boolean;
}
