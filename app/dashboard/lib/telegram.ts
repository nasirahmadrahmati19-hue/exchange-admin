export async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (e) {
    console.error("Telegram error:", e);
    return false;
  }
}

export async function getLastChatId(token: string): Promise<string> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    if (!data.ok) return "";
    const arr = data.result || [];
    if (arr.length === 0) return "";
    const last = arr[arr.length - 1];
    const chat = last.message?.chat || last.my_chat_member?.chat || last.edited_message?.chat;
    return chat ? String(chat.id) : "";
  } catch {
    return "";
  }
}

export function loadSettings() {
  try {
    const s = localStorage.getItem("db_settings");
    if (s) return JSON.parse(s);
  } catch {}
  return {};
}
