// =====================================================
// 🤖 کتابخانه ربات تلگرام — صرافی برادران نورزاد
// =====================================================

// 🆕 تایپ‌ها
export interface TelegramUserInfo {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  is_bot: boolean;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUserInfo;
  chat: {
    id: number;
    type: string;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  lastSeen: string;
  lastMessage?: string;
}

// =====================================================
// 📨 ارسال پیام به تلگرام
// =====================================================

/**
 * ارسال پیام متنی به یک chat_id مشخص
 * @param token - توکن ربات تلگرام
 * @param chatId - شناسه چت کاربر
 * @param text - متن پیام
 * @param options - گزینه‌های اضافی (مثل silent mode)
 * @returns boolean - آیا ارسال موفق بود؟
 */
export async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  options?: {
    silent?: boolean;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2" | "none";
  }
): Promise<boolean> {
  try {
    if (!token || !chatId || !text) {
      console.error("Telegram: پارامترهای ارسال ناقص است");
      return false;
    }

    const body: any = {
      chat_id: chatId,
      text: text,
      disable_notification: options?.silent === true,  // ✅ کنترل صدا
      disable_web_page_preview: true,
    };

    // فقط parse_mode را اضافه کن اگر none نباشد
    if (options?.parseMode !== "none") {
      body.parse_mode = options?.parseMode || "HTML";
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error("Telegram send failed:", data.description || "Unknown error");
      return false;
    }

    console.log("✅ Telegram message sent to:", chatId);
    return true;
  } catch (e) {
    console.error("Telegram send error:", e);
    return false;
  }
}

// =====================================================
// 📥 دریافت آپدیت‌ها از تلگرام
// =====================================================

/**
 * دریافت تمام آپدیت‌های اخیر ربات
 * @param token - توکن ربات تلگرام
 * @param limit - حداکثر تعداد آپدیت‌ها (پیش‌فرض 100)
 * @returns آرایه‌ای از آپدیت‌ها
 */
export async function getUpdates(
  token: string,
  limit: number = 100
): Promise<TelegramUpdate[]> {
  try {
    if (!token) {
      console.error("Telegram: توکن وارد نشده است");
      return [];
    }

    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error("getUpdates failed:", data.description || "Unknown error");
      return [];
    }

    console.log(`📥 ${data.result?.length || 0} update دریافت شد`);
    return data.result || [];
  } catch (e) {
    console.error("getUpdates error:", e);
    return [];
  }
}

// =====================================================
// 💬 دریافت آخرین chat_id
// =====================================================

/**
 * دریافت آخرین chat_id از آپدیت‌های ربات
 * @param token - توکن ربات تلگرام
 * @returns chat_id یا null
 */
export async function getLastChatId(token: string): Promise<number | null> {
  try {
    const updates = await getUpdates(token, 10);

    if (!updates || updates.length === 0) {
      return null;
    }

    // آخرین آپدیت را پیدا کن
    for (let i = updates.length - 1; i >= 0; i--) {
      const update = updates[i];
      if (update.message?.chat?.id) {
        return update.message.chat.id;
      }
    }

    return null;
  } catch (e) {
    console.error("getLastChatId error:", e);
    return null;
  }
}

// =====================================================
// 👥 استخراج لیست کاربران unique از آپدیت‌ها
// =====================================================

/**
 * دریافت لیست کاربران unique که به ربات پیام داده‌اند
 * @param token - توکن ربات تلگرام
 * @returns آرایه‌ای از کاربران
 */
export async function getTelegramUsers(token: string): Promise<TelegramUser[]> {
  try {
    const updates = await getUpdates(token, 100);
    const usersMap = new Map<number, TelegramUser>();

    updates.forEach((update: TelegramUpdate) => {
      // بررسی message
      if (update.message?.from) {
        const user = update.message.from;

        // نادیده گرفتن ربات‌ها
        if (user.is_bot) return;

        const existing = usersMap.get(user.id);
        const messageDate = update.message.date
          ? new Date(update.message.date * 1000).toLocaleString("fa-IR")
          : "";

        // اگر کاربر جدید است یا پیام جدیدتری دارد
        if (!existing || update.message.date > (existing as any).lastTimestamp) {
          usersMap.set(user.id, {
            id: user.id,
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            username: user.username || "",
            lastSeen: messageDate,
            lastMessage: update.message.text || "",
            // فیلد مخفی برای مرتب‌سازی
            ...( { lastTimestamp: update.message.date } as any ),
          });
        }
      }
    });

    // تبدیل به آرایه و مرتب‌سازی بر اساس آخرین فعالیت
    const usersList = Array.from(usersMap.values())
      .map((user: any) => {
        // حذف فیلد lastTimestamp قبل از بازگشت
        const { lastTimestamp, ...rest } = user;
        return rest;
      })
      .sort((a: any, b: any) => b.id - a.id);

    console.log(`👥 ${usersList.length} کاربر unique دریافت شد`);
    return usersList;
  } catch (e) {
    console.error("getTelegramUsers error:", e);
    return [];
  }
}

// =====================================================
// 🗑️ پاک کردن آپدیت‌های قدیمی (اختیاری)
// =====================================================

/**
 * پاک کردن آپدیت‌های قدیمی با استفاده از offset
 * این تابع بعد از پردازش آپدیت‌ها، آن‌ها را از سرور تلگرام حذف می‌کند
 * @param token - توکن ربات تلگرام
 * @param offset - offset برای پاک کردن
 */
export async function clearUpdates(
  token: string,
  offset: number
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset }),
      }
    );
    const data = await res.json();
    return res.ok && data.ok === true;
  } catch (e) {
    console.error("clearUpdates error:", e);
    return false;
  }
}

// =====================================================
// 🏷️ اطلاعات ربات
// =====================================================

/**
 * دریافت اطلاعات ربات (نام، username)
 * @param token - توکن ربات تلگرام
 */
export async function getBotInfo(token: string): Promise<{
  id: number;
  first_name: string;
  username: string;
} | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      return null;
    }

    return {
      id: data.result.id,
      first_name: data.result.first_name,
      username: data.result.username,
    };
  } catch (e) {
    console.error("getBotInfo error:", e);
    return null;
  }
}
