"use client";

// ============================================================
// 🤖 ارسال پیام تلگرام — فقط از طریق API Route سمت سرور
// ------------------------------------------------------------
// 🔴 امنیتی: توکن ربات هرگز در مرورگر استفاده یا ارسال نمی‌شود.
// همه فراخوانی‌ها به /api/telegram با Firebase ID Token انجام می‌شود
// و توکن فقط در متغیر محیطی سرور (TELEGRAM_BOT_TOKEN) نگهداری می‌گردد.
// ✅ یکپارچگی: نتیجه ارسال (موفق/ناموفق) برگردانده می‌شود تا
// تراکنش‌های ناموفق قابل شناسایی و تلاش مجدد باشند.
// ============================================================


import { auth } from "./firebase";

/** فرار دادن کاراکترهای HTML برای جلوگیری از تزریق (XSS) در پیام‌های parse_mode=HTML */
export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * ارسال پیام تلگرام از طریق endpoint امن سمت سرور.
 * @param _botToken پارامتر سازگاری با کد قدیمی — عمداً نادیده گرفته می‌شود؛
 *                  توکن فقط سمت سرور از ENV خوانده می‌شود.
 */
export async function sendTelegram(_botToken: string, chatId: string, text: string): Promise<SendResult> {
  if (!chatId || !text) return { ok: false, error: "missing chatId or text" };
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return { ok: false, error: "unauthenticated" };
    const idToken = await currentUser.getIdToken();
    const res = await fetch("/api/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ chatId, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok !== true) {
      console.warn("⚠️ Telegram receipt delivery failed:", data?.error || res.status);
      return { ok: false, error: data?.error || `http_${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error("Telegram send via server error:", e);
    return { ok: false, error: e?.message || "network_error" };
  }
}

export interface TelegramBotUser {
  id: number;
  name: string;
  username: string;
  chat_id: number;
}

/**
 * دریافت لیست کاربرانی که با ربات گفتگو کرده‌اند — از طریق endpoint سمت سرور.
 * 🔴 امنیتی: توکن ربات هرگز در مرورگر استفاده نمی‌شود؛ پارامتر _botToken
 * عمداً نادیده گرفته می‌شود و سرور از TELEGRAM_BOT_TOKEN (ENV) استفاده می‌کند.
 */
export async function fetchTelegramUsers(_botToken: string): Promise<TelegramBotUser[]> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];
    const idToken = await currentUser.getIdToken();
    const res = await fetch("/api/telegram", {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok !== true) {
      console.warn("⚠️ دریافت کاربران تلگرام ناموفق بود:", data?.error || res.status);
      return [];
    }
    return Array.isArray(data.users) ? data.users : [];
  } catch (e) {
    console.error("fetchTelegramUsers error:", e);
    return [];
  }
}

/**
 * ارسال گروهی پیام‌ها (رسید/اطلاعیه) با حذف chatId تکراری.
 * خلاصه موفق/ناموفق در کنسول ثبت می‌شود تا ارسال‌های ناموفق بی‌سروصدا نمانند.
 */
export async function sendTelegramBatch(messages: { chatId: string; text: string }[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const m of messages) {
    if (!m?.chatId || seen.has(String(m.chatId))) continue;
    seen.add(String(m.chatId));
    // توکن خالی ارسال می‌شود؛ سرور از ENV استفاده می‌کند
    const r = await sendTelegram("", m.chatId, m.text);
    if (r.ok) sent++;
    else failed++;
  }
  if (failed > 0) {
    console.warn(`⚠️ ${failed} پیام تلگرام ارسال نشد (موفق: ${sent}). رسید کاغذی همچنان معتبر است.`);
  }
  return { sent, failed };
}
