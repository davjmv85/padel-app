/**
 * Send a message to Telegram via bot API.
 * Token and chat ID are stored in env vars.
 * Fails silently to avoid breaking the main flow.
 */
export async function sendTelegramMessage(message: string): Promise<void> {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram bot not configured');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    if (!res.ok) {
      console.warn('Telegram send failed:', await res.text());
    }
  } catch (err) {
    console.warn('Telegram error:', err);
  }
}
