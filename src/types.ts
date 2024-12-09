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

export type NotificationLevel = 'info' | 'warning' | 'error';

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

export type BatcherConfig = {
  maxBatchSize: number;
  maxWaitMs: number;
  concurrentProcessors?: number;
  singleton?: boolean;
  id?: string;
  processors?: MessageProcessor[];
};

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  batchDelay?: number; // in ms, default 60000
  development?: boolean;
}

// Simple processor interface that works with arrays
export interface MessageProcessor {
  name: string;
  processBatch(messages: Message[]): void | Promise<void>;
}

export interface MessageBatcher {
  info(message: string): void;
  warning(message: string): void;
  error(message: string, error?: Error | string): void;
  queueMessage(message: string, level: NotificationLevel): void;
  processBatch(chatId: string): void;
  flush(): Promise<void>;
  flushSync(): void;
  destroy(): Promise<void>;
  queues: Map<string, Queue<Message>>;
  timers: Map<string, NodeJS.Timeout>;
  addProcessor(processor: MessageProcessor): void;
  removeProcessor(name: string): void;
  removeAllProcessors(): void;
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