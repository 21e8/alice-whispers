import { NotificationLevel, QueuedMessage, TelegramConfig } from './types';
import { EMOJI_MAP, sendTelegramMessage } from './utils';

let instance: MessageBatcher | null = null;

export class MessageBatcher {
  private messageQueue: QueuedMessage[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly config!: TelegramConfig;

  constructor(config: TelegramConfig) {
    if (instance) {
      return instance;
    }
    
    this.config = {
      batchDelay: 60000,
      development: false,
      ...config,
    };

    instance = this;
  }

  queueMessage(message: string, level: NotificationLevel): void {
    if (this.config.development) {
      console.log(`[DEV] Would send ${level} message: ${message}`);
      return;
    }

    this.messageQueue.push({
      message,
      level,
      timestamp: Date.now(),
    });

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(
        () => this.sendBatch(),
        this.config.batchDelay
      );
    }
  }

  private getPriorityScore(level: NotificationLevel): number {
    switch (level) {
      case 'error':
        return 3;
      case 'warning':
        return 2;
      case 'info':
        return 1;
      default:
        return 0;
    }
  }

  async sendBatch(): Promise<void> {
    if (this.messageQueue.length === 0) {
      this.batchTimeout = null;
      return;
    }

    // Sort messages by priority (most important last)
    const sortedMessages = [...this.messageQueue].sort((a, b) => {
      const priorityDiff =
        this.getPriorityScore(a.level) - this.getPriorityScore(b.level);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    // Format messages with proper emojis and headers
    const formattedMessages = sortedMessages.map(({ message, level }) => {
      const emoji = EMOJI_MAP[level];
      return `${emoji} *${level.toUpperCase()}*\n${message}`;
    });

    // Combine all messages with separators
    const batchedMessage = formattedMessages.join('\n\n───────────────\n\n');

    try {
      await sendTelegramMessage(
        batchedMessage,
        this.config.botToken,
        this.config.chatId
      );
    } catch (error) {
      console.error('Failed to send batched messages:', error);
      // Re-queue failed messages if needed
      if (error instanceof Error && error.message.includes('retry')) {
        this.messageQueue.push(...sortedMessages);
        this.batchTimeout = setTimeout(
          () => this.sendBatch(),
          5000 // Retry after 5 seconds
        );
        return;
      }
    }

    // Clear the queue and reset the timeout
    this.messageQueue = [];
    this.batchTimeout = null;
  }

  // Method to force send remaining messages, useful for cleanup
  async flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    await this.sendBatch();
  }
}
