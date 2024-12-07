# 0xAlice Telegram Bot

Batched Telegram notification bot for 0xAlice.

## Installation

```bash
yarn add 0xalice-tgram-bot
```

## Usage

```typescript
import { MessageBatcher } from '0xalice-tgram-bot';

const bot = new MessageBatcher({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
  batchDelay: 60000, // optional, defaults to 60000
  development: process.env.NODE_ENV === 'development' // optional
});

bot.info('Service started');
bot.warning('High memory usage');
bot.error('Database connection failed');
```
