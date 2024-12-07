// import { Message, MessageProcessor } from '../types';
// import { classifyError } from '../utils/errorClassifier';
// // import fetch from 'node-fetch';

// export type DiscordConfig = {
//   webhookUrl: string;
//   username?: string;
// };

// export function createDiscordProcessor(config: DiscordConfig): MessageProcessor {
//   function getLevelEmoji(level: string): string {
//     const emojis = {
//       info: 'ℹ️',
//       warning: '⚠️',
//       error: '🚨'
//     };
//     return emojis[level as keyof typeof emojis] || '';
//   }

//   async function processBatch(messages: Message[]): Promise<void> {
//     if (!messages.length) {
//       return;
//     }

//     const formattedMessages = [];
//     for (const msg of messages) {
//       let text = `${getLevelEmoji(msg.level)} ${msg.text}`;

//       if (msg.level === 'error' && msg.error) {
//         const classified = classifyError(msg.error);

//         // Skip throttled errors
//         if (classified.shouldThrottle) {
//           if (classified.nextAllowedTimestamp) {
//             const waitMinutes = Math.ceil(
//               (classified.nextAllowedTimestamp - Date.now()) / 60000
//             );
//             text += `\n[THROTTLED] Similar errors suppressed for ${waitMinutes} minutes`;
//           }
//           continue;
//         }

//         text += `\nCategory: ${classified.category}`;
//         text += `\nSeverity: ${classified.severity}`;
//         if (classified.details) {
//           text += `\nDetails: ${JSON.stringify(classified.details)}`;
//         }
//       }

//       formattedMessages.push(text);
//     }

//     if (!formattedMessages.length) {
//       console.log('[Discord] No messages to send');
//       return;
//     }

//     await fetch(config.webhookUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         content: formattedMessages.join('\n\n'),
//         username: config.username
//       })
//     });
//   }

//   return { processBatch };
// }