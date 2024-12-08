export type NotificationLevel = 'info' | 'warning' | 'error';

// Predefined severity levels with option for custom strings
export type SeverityLevel =
  | 'low'
  | 'medium'
  | 'high'
  | (string & NonNullable<unknown>);

// Internal array format
export type Message = [
  string, // chatId
  string, // text
  NotificationLevel, // level
  (Error | string)? // optional error
];

// External object format for processor implementations
// export type MessageObject = {
//   chatId: string;
//   text: string;
//   level: NotificationLevel;
//   error?: Error | string;
// };

export type BatcherConfig = {
  maxBatchSize: number;
  maxWaitMs: number;
  concurrentProcessors?: number;
  singleton?: boolean;
  id?: string;
};

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  batchDelay?: number; // in ms, default 60000
  development?: boolean;
}

// Internal processor interface
export interface InternalMessageProcessor {
  type: 'internal';
  name: string;
  processBatch(messages: Message[]): void | Promise<void>;
  processBatchSync?(messages: Message[]): void;
}

// External processor interface
export interface MessageProcessor {
  type: 'external' | 'internal';
  name: string;
  processBatch(messages: Message[]): void | Promise<void>;
  processBatchSync?(messages: Message[]): void;
}
// External processor interface
export interface ExternalMessageProcessor {
  type: 'external';
  name: string;
  processBatch(messages: Message[]): void | Promise<void>;
  processBatchSync?(messages: Message[]): void;
}

// Helper type to convert external processor to internal
export type ProcessorAdapter = (
  processor: MessageProcessor
) => InternalMessageProcessor;

export interface MessageBatcher {
  info(message: string): void;
  warning(message: string): void;
  error(message: string, error?: Error | string): void;
  queueMessage(message: string, level: NotificationLevel): void;
  processBatch(chatId: string): void;
  flush(): Promise<void>;
  flushSync(): void;
  destroy(): void;
  queues: Map<string, Message[]>;
  timers: Map<string, NodeJS.Timeout>;
  addExtraProcessor(processor: ExternalMessageProcessor): void;
  removeExtraProcessor(name: string): void;
  removeAllExtraProcessors(): void;
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


// Define the named object interface
export type ErrorPatternConfig = {
  readonly name: string;
  readonly pattern:
    | RegExp
    | ((message: string) => boolean)
    | Promise<boolean>
    | ((message: string) => Promise<boolean>);
  readonly category: string;
  readonly severity: SeverityLevel;
  readonly aggregation?: {
    readonly windowMs: number;
    readonly countThreshold: number;
  };
};

// Internal tuple type for storage
export type ErrorPattern = readonly [
  (
    | RegExp
    | ((message: string) => boolean)
    | Promise<boolean>
    | ((message: string) => Promise<boolean>)
  ),
  string, // category
  SeverityLevel, // severity
  [number, number]? // [windowMs, countThreshold] for aggregation
];