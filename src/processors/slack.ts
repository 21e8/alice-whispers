// import { Message, MessageProcessor } from '../types';
// import { classifyError } from '../utils/errorClassifier';
// // import fetch from 'node-fetch';  // Uncomment this

// export type SlackConfig = {
//   webhookUrl: string;
//   channel: string;
//   username?: string;
// };

// export function createSlackProcessor(config: SlackConfig): MessageProcessor {
//   function getLevelEmoji(level: string): string {
//     const emojis = {
//       info: ':information_source:',
//       warning: ':warning:',
//       error: ':rotating_light:',
//     };
//     return emojis[level as keyof typeof emojis] || '';
//   }

//   async function processBatch(messages: Message[]): Promise<void> {
//     if (!messages.length) {
//       return;
//     }

//     const blocks = [];
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

//       blocks.push({
//         type: 'section',
//         text: {
//           type: 'mrkdwn',
//           text,
//         },
//       });
//     }

//     if (!blocks.length) {
//       console.log('[Slack] No messages to send');
//       return;
//     }

//     await fetch(config.webhookUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         channel: config.channel,
//         username: config.username,
//         blocks,
//       }),
//     });
//   }

//   return { processBatch };
// }
