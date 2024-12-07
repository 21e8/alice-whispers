import { Message, MessageProcessor } from '../types';
import { createTransport, Transporter } from 'nodemailer';

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

export class EmailProcessor implements MessageProcessor {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  async processBatch(messages: Message[]): Promise<void> {
    const htmlContent = messages
      .map((msg) => `<p>${this.getLevelBadge(msg.level)} ${msg.text}</p>`)
      .join('\n');

    await this.transporter.sendMail({
      from: this.config.from,
      to: this.config.to,
      subject: this.config.subject || 'Notification Batch',
      html: `
        <div style="font-family: sans-serif;">
          ${htmlContent}
        </div>
      `,
    });
  }

  private getLevelBadge(level: string): string {
    const badges = {
      info: '�� INFO',
      warning: '🟡 WARNING',
      error: '🔴 ERROR',
    };
    return badges[level as keyof typeof badges] || level;
  }
}
