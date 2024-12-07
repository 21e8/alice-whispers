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