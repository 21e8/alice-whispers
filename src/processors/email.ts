// import { Message, MessageProcessor } from '../types';
// import { createTransport } from 'nodemailer';
// import { classifyError } from '../utils/errorClassifier';

// export type EmailConfig = {
//   host: string;
//   port: number;
//   secure: boolean;
//   auth: {
//     user: string;
//     pass: string;
//   };
//   from: string;
//   to: string | string[];
//   subject?: string;
// };

// export function createEmailProcessor(config: EmailConfig): MessageProcessor {
//   const transporter = createTransport({
//     host: config.host,
//     port: config.port,
//     secure: config.secure,
//     auth: config.auth,
//   });

//   function getLevelBadge(level: string): string {
//     const badges = {
//       info: '🔵 INFO',
//       warning: '🟡 WARNING',
//       error: '🔴 ERROR',
//     };
//     return badges[level as keyof typeof badges] || level;
//   }

//   async function processBatch(messages: Message[]): Promise<void> {
//     const htmlContent = [];
//     for (const msg of messages) {
//       let text = `<p>${getLevelBadge(msg.level)} ${msg.text}`;

//       if (msg.level === 'error' && msg.error) {
//         const classified = classifyError(msg.error);

//         // Skip throttled errors
//         if (classified.shouldThrottle) {
//           if (classified.nextAllowedTimestamp) {
//             const waitMinutes = Math.ceil(
//               (classified.nextAllowedTimestamp - Date.now()) / 60000
//             );
//             text += `<br>[THROTTLED] Similar errors suppressed for ${waitMinutes} minutes`;
//           }
//           continue;
//         }

//         text += `<br>Category: ${classified.category}`;
//         text += `<br>Severity: ${classified.severity}`;
//         if (classified.details) {
//           text += `<br>Details: ${JSON.stringify(classified.details)}`;
//         }
//       }

//       text += '</p>';
//       htmlContent.push(text);
//     }

//     if (!htmlContent.length) {
//       console.log('[Email] No messages to send');
//       return;
//     }

//     await transporter.sendMail({
//       from: config.from,
//       to: config.to,
//       subject: config.subject || 'Notification Batch',
//       html: `
//         <div style="font-family: sans-serif;">
//           ${htmlContent.join('\n')}
//         </div>
//       `,
//     });
//   }

//   return { processBatch };
// }
