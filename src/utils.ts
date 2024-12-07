export const EMOJI_MAP = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '🚨',
};

export async function sendTelegramMessage(
  message: string,
  botToken: string,
  chatId: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send Telegram notification: ${error}`);
    }
  } catch (error) {
    throw new Error(`Error sending Telegram notification: ${error}`);
  }
}
