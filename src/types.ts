export type NotificationLevel = "info" | "warning" | "error";

export type QueuedMessage = {
  message: string;
  level: NotificationLevel;
  timestamp: number;
};

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  batchDelay?: number;  // in ms, default 60000
  development?: boolean;
}

export type Message = {
  chatId: string;
  text: string;
};

export type BatcherConfig = {
  maxBatchSize: number;
  maxWaitMs: number;
  processBatch: (messages: Message[]) => Promise<void> | void;
};