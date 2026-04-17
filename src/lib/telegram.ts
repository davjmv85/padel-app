/**
 * Send a message to Telegram via bot API.
 * Token and chat IDs are stored in env vars.
 *
 * Targets:
 *  - 'admin' → VITE_TELEGRAM_CHAT_ID_ADMIN (staff interno: inscripciones, bajas, pagos)
 *  - 'group' → VITE_TELEGRAM_CHAT_ID_GROUP (jugadores: eventos publicados, cupos, etc.)
 *
 * Cada var acepta uno o varios IDs separados por coma. Fire-and-forget: si falla,
 * loguea warning y sigue sin romper el flujo principal.
 */

export type TelegramTarget = 'admin' | 'group';

export function formatMsg({ emoji, title, body }: { emoji: string; title: string; body: string }): string {
  return `${emoji} <b>${title}</b>\n\n${body}`;
}

export async function sendTelegramMessage(message: string, target: TelegramTarget = 'admin'): Promise<void> {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatIdRaw =
    target === 'group'
      ? import.meta.env.VITE_TELEGRAM_CHAT_ID_GROUP
      : import.meta.env.VITE_TELEGRAM_CHAT_ID_ADMIN;

  if (!token || !chatIdRaw) {
    console.warn(`Telegram bot not configured for target "${target}"`);
    return;
  }

  const chatIds = String(chatIdRaw)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    console.warn(`Telegram bot not configured for target "${target}"`);
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
          console.warn(`Telegram send failed (chat ${chatId}, target ${target}):`, await res.text());
        }
      } catch (err) {
        console.warn(`Telegram error (chat ${chatId}, target ${target}):`, err);
      }
    })
  );
}
