/**
 * Send a message to Telegram via bot API.
 * Token and chat IDs are stored in env vars.
 * VITE_TELEGRAM_CHAT_ID puede ser un único ID o varios separados por coma.
 * Fails silently to avoid breaking the main flow.
 */
export async function sendTelegramMessage(message: string): Promise<void> {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatIdRaw = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!token || !chatIdRaw) {
    console.warn('Telegram bot not configured');
    return;
  }

  const chatIds = String(chatIdRaw)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    console.warn('Telegram bot not configured');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
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
          console.warn(`Telegram send failed (chat ${chatId}):`, await res.text());
        }
      } catch (err) {
        console.warn(`Telegram error (chat ${chatId}):`, err);
      }
    })
  );
}
