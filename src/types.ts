export type NotificationLevel = 'info' | 'warning' | 'error';

export type Message = {
  chatId: string;
  text: string;
  level: NotificationLevel;
  error?: Error | string;
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
  processBatch(messages: Message[]): void | Promise<void>;
  processBatchSync?(messages: Message[]): void;
}

export interface MessageBatcher {
  info(message: string): void;
  warning(message: string): void;
  error(message: string, error?: Error | string): void;
  queueMessage(message: string, level: NotificationLevel): void;
  processBatch(chatId: string): void;
  flush(): Promise<void>;
  flushSync(): void;
  destroy(): void;
}

export type ProcessorOptions = {
  markdown?: {
    escapeSpecialChars?: boolean;
  };
};

export type ProcessorConfig = {
  type: string;
  options?: ProcessorOptions[keyof ProcessorOptions];
};

export type ProcessorResult = {
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  silent?: boolean;
};

export type Processor = {
  process: (
    message: string,
    config?: ProcessorConfig
  ) => Promise<ProcessorResult>;
};
