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

export interface MessageBatcher {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  queueMessage(message: string, level: NotificationLevel): void;
  flush(): Promise<void>;
  destroy(): void;
}

export type ProcessorOptions = {
  markdown?: {
    escapeSpecialChars?: boolean;
  };
  alert?: {
    level: 'info' | 'warning' | 'critical';
    silent?: boolean;
  };
  rateLimit?: {
    intervalMs: number;
    maxMessages?: number;
  };
  email?: {
    subject?: string;
    template?: string;
    priority?: 'high' | 'normal' | 'low';
  };
  discord?: {
    username?: string;
    avatar?: string;
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
