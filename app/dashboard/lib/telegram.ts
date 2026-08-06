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

// 🆕 تابع جدید: دریافت لیست کاربران یکتا از ربات
export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  lastSeen: string;
}

export async function getTelegramUsers(token: string): Promise<TelegramUser[]> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();
    if (!data.ok) return [];
    
    const arr = data.result || [];
    const userMap = new Map<number, TelegramUser>();
    
    // استخراج کاربران یکتا از همه پیام‌ها
    for (const update of arr) {
      const chat = update.message?.chat || 
                   update.my_chat_member?.chat || 
                   update.edited_message?.chat ||
                   update.callback_query?.message?.chat;
      
      if (chat && chat.type === "private") {
        const existing = userMap.get(chat.id);
        const timestamp = update.message?.date || 
                         update.my_chat_member?.date || 
                         update.edited_message?.date ||
                         update.callback_query?.message?.date || 0;
        
        // فقط اگر کاربر جدید است یا پیام جدیدتر دارد
        if (!existing || timestamp > new Date(existing.lastSeen).getTime() / 1000) {
          userMap.set(chat.id, {
            id: chat.id,
            firstName: chat.first_name || "کاربر",
            lastName: chat.last_name || "",
            username: chat.username || "",
            lastSeen: new Date(timestamp * 1000).toISOString(),
          });
        }
      }
    }
    
    // مرتب‌سازی بر اساس آخرین فعالیت (جدیدترین اول)
    return Array.from(userMap.values()).sort((a, b) => 
      new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    );
  } catch (e) {
    console.error("Get Telegram users error:", e);
    return [];
  }
}

export function loadSettings() {
  try {
    const s = localStorage.getItem("db_settings");
    if (s) return JSON.parse(s);
  } catch {}
  return {};
}
