import Queue from "./utils/queue";

// Custom AggregateError implementation
export class BatchAggregateError extends Error {
  readonly errors: Queue<Error>;

  constructor(errors: Queue<Error>, message: string) {
    super(message);
    this.name = 'BatchAggregateError';
    this.errors = errors;
  }
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'none';

export type NotificationLevel = 'info' | 'warning' | 'error' | 'none';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Error | any)? // optional error
];

export type BatcherConfig = {
  maxBatchSize: number;
  maxWaitMs: number;
  concurrentProcessors?: number;
  singleton?: boolean;
  id?: string;
  processors?: MessageProcessor[];
  errorPatterns?: ErrorPatternConfig[];
};

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  batchDelay?: number; // in ms, default 60000
  development?: boolean;
  logLevel?: LogLevel; // defaults to 'trace'
}

export type TelegramConfigArray = [
  string, // botToken
  string, // chatId
  number?, // batchDelay
  boolean?, // development
  LogLevel?, // logLevel
];

// Simple processor interface that works with arrays
export interface MessageProcessor {
  name: string;
  logLevel?: LogLevel;
  processBatch(messages: Message[] | Queue<Message>): void;
}

export interface MessageBatcher {
  info(message: string): void;
  warning(message: string): void;
  error(message: string, error?: Error | string): void;
  queueMessage(message: string, level: NotificationLevel): void;
  processBatch(chatId: string): void;
  flush(): Promise<Queue<Error>>;
  flushSync(): void;
  destroy(): Promise<Queue<Error>>;
  destroyAll(): Promise<Queue<Error>>;
  queues: Map<string, Queue<Message>>;
  timers: Map<string, NodeJS.Timeout>;
  addProcessor(processor: MessageProcessor): void;
  removeProcessor(name: string): void;
  removeAllProcessors(): void;
  // errorPatterns: ErrorPatternConfig[];
}

// Error pattern types
export type ErrorPatternConfig = {
  readonly name: string;
  readonly pattern:
    | RegExp
    | ((message: string) => boolean)
    // | Promise<boolean>
    // | ((message: string) => Promise<boolean>);
  readonly category: string;
  readonly severity: SeverityLevel;
  readonly aggregation?: {
    readonly windowMs: number;
    readonly countThreshold: number;
  };
};

export type ErrorPattern = readonly [
  (
    | RegExp
    | ((message: string) => boolean)
    // | Promise<boolean>
    // | ((message: string) => Promise<boolean>)
  ),
  string, // category
  SeverityLevel, // severity
  [number, number]? // [windowMs, countThreshold] for aggregation
];