export type NotificationLevel = 'info' | 'warning' | 'error';

export type Message = {
  chatId: string;
  text: string;
  level: NotificationLevel;
};

export type BatcherConfig = {
  maxBatchSize: number;
  maxWaitMs: number;
};

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  batchDelay?: number; // in ms, default 60000
  development?: boolean;
}

export interface MessageProcessor {
  processBatch(messages: Message[]): Promise<void>;
}
