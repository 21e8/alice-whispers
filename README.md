# 0xAlice Telegram Bot

Batched Telegram notification bot for 0xAlice.

## Installation

### From npm registry
```bash
npm install 0xalice-tgram-bot
# or with yarn
yarn add 0xalice-tgram-bot
```

### From GitHub Packages
First, authenticate with GitHub Packages:
```bash
npm login --registry=https://npm.pkg.github.com
# or create .npmrc with:
@21e8:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Then install:
```bash
npm install @21e8/0xalice-tgram-bot
# or with yarn
yarn add @21e8/0xalice-tgram-bot
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
