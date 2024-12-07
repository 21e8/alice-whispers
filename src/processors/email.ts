import { Message, MessageProcessor } from '../types';
import { createTransport } from 'nodemailer';

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string | string[];
  subject?: string;
};

export function createEmailProcessor(config: EmailConfig): MessageProcessor {
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  function getLevelBadge(level: string): string {
    const badges = {
      info: '🔵 INFO',
      warning: '🟡 WARNING',
      error: '🔴 ERROR',
    };
    return badges[level as keyof typeof badges] || level;
  }

  async function processBatch(messages: Message[]): Promise<void> {
    const htmlContent = messages
      .map((msg) => `<p>${getLevelBadge(msg.level)} ${msg.text}</p>`)
      .join('\n');

    await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject: config.subject || 'Notification Batch',
      html: `
        <div style="font-family: sans-serif;">
          ${htmlContent}
        </div>
      `,
    });
  }

  return { processBatch };
}
