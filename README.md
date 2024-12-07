# @vbase/telegram-bot

Batched Telegram notification bot for VBase.

## Installation

```bash
yarn add @vbase/telegram-bot
```

## Usage

```typescript
import { TelegramBot } from '@vbase/telegram-bot';

const bot = new TelegramBot({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
  batchDelay: 60000, // optional, defaults to 60000
  development: process.env.NODE_ENV === 'development' // optional
});

bot.info('Service started');
bot.warning('High memory usage');
bot.error('Database connection failed');
```
