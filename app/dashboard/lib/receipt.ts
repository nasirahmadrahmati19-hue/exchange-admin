// ============================================================
// lib/receipt.ts
// 🔴 تغییرات امنیتی/معماری:
// 1) خواندن تنظیمات از localStorage («fx-settings») حذف شد؛ تنظیمات
//    فقط از Firestore (کش در-حافظه‌ای telegramSettings) خوانده می‌شود.
// 2) ارسال مستقیم با توکن در کلاینت حذف شد؛ همه ارسال‌ها از طریق
//    API Route سمت سرور (/api/telegram) انجام می‌شود و توکن ربات
//    هرگز در مرورگر استفاده یا منتقل نمی‌گردد.
// 3) chatId مشتری از آرگومان صریح می‌شود؛ خواندن «fx-customers»
//    از localStorage حذف شد.
// ============================================================

import { getTelegramSettings } from "./telegramSettings";
import { sendTelegram } from "./telegramSend";

// ===== تبدیل عدد به حروف فارسی =====
export function numberToPersianWords(num: number): string {
  if (!Number.isFinite(num) || num === 0) return "صفر";
  
  const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const hundreds = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];
  
  function threeDigits(n: number): string {
    if (n === 0) return "";
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    
    let result = hundreds[h];
    
    if (remainder >= 10 && remainder <= 19) {
      if (result) result += " و ";
      result += teens[remainder - 10];
    } else {
      if (t > 0) {
        if (result) result += " و ";
        result += tens[t];
      }
      if (o > 0) {
        if (result) result += " و ";
        result += ones[o];
      }
    }
    
    return result;
  }
  
  const parts: string[] = [];
  let scaleIndex = 0;
  let n = Math.floor(Math.abs(num));
  
  while (n > 0 && scaleIndex < scales.length) {
    const chunk = n % 1000;
    if (chunk > 0) {
      const chunkWords = threeDigits(chunk);
      if (scaleIndex > 0) {
        parts.unshift(`${chunkWords} ${scales[scaleIndex]}`);
      } else {
        parts.unshift(chunkWords);
      }
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }
  
  return parts.join(" و ");
}

// ===== فرمت تاریخ شمسی =====
export function formatShamsiDateTime(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    
    const get = (t: string) => parts.find(p => p.type === t)?.value || "0";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    const min = String(minutes).padStart(2, "0");
    
    return `${year}/${month}/${day} ${h12}:${min} ${ampm}`;
  } catch {
    return "-";
  }
}

// ===== ساخت متن رسید =====
export type ReceiptData = {
  type: "deposit" | "withdraw" | "exchange" | "hawala" | "transfer" | "convert";
  date: Date;
  trackingCode: string;
  description: string;
  rate?: number;
  amount: number;
  currency: string;
  customerName?: string;
  balances: Record<string, number>;
};

export function buildReceiptText(data: ReceiptData): string {
  const isWithdraw = data.type === "withdraw" || data.type === "exchange";
  const title = isWithdraw ? "🔴 سند برد" : "🟢 سند رسید";
  
  const dateStr = formatShamsiDateTime(data.date);
  const amountWords = numberToPersianWords(data.amount);
  const formattedAmount = data.amount.toLocaleString("en-US");
  
  let text = `${title}\n\n`;
  text += `🗓 تاریخ: ${dateStr}\n\n`;
  text += `🛅 پیگیری: ${data.trackingCode}\n\n`;
  
  if (data.customerName) {
    text += `👤 مشتری: ${data.customerName}\n\n`;
  }
  
  text += `📑 شرح: ${data.description}, مبلغ ${amountWords}\n\n`;
  
  if (data.rate && data.rate > 0) {
    text += `📊 نرخ: ${data.rate}\n\n`;
  }
  
  text += `💰 مبلغ: ${formattedAmount} ${data.currency}\n\n`;
  text += `-------------بیلانس فعلی--------------\n`;
  
  const currencyLabels: Record<string, string> = {
    AFN: "افغانی",
    USD: "دالر",
    EUR: "یورو",
    IRR: "تومان",
    PKR: "کلدار",
  };
  
  for (const [currency, balance] of Object.entries(data.balances)) {
    const label = currencyLabels[currency] || currency;
    const status = balance > 0 ? "طلب" : balance < 0 ? "قرض" : "";
    const formattedBalance = Math.abs(balance).toLocaleString("en-US");
    text += `${label}: ${formattedBalance} ${status}\n`;
  }
  
  text += `\n🏦 صرافی برادران نورزاد — هرات`;
  
  return text;
}

// ===== ارسال پیام به تلگرام (فقط از طریق API Route سمت سرور) =====
/**
 * 🔴 سازگار با امضای قدیمی، اما پارامتر botToken عمداً نادیده گرفته می‌شود:
 * توکن فقط در متغیر محیطی سرور (TELEGRAM_BOT_TOKEN) نگهداری می‌شود و
 * هرگز در کلاینت استفاده یا منتقل نمی‌گردد.
 */
export async function sendTelegramMessage(_botToken: string, chatId: string, text: string): Promise<boolean> {
  if (!chatId) return false;
  // فرار HTML برای جلوگیری از تزریق در parse_mode=HTML
  const safeText = String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const r = await sendTelegram("", chatId, safeText);
  return r.ok;
}

// ===== تابع اصلی: ارسال رسید بعد از معامله =====
/**
 * @param customerChatId شناسه چت مشتری که توسط فراخواننده (از داده Firestore) می‌شود.
 *   ✅ خواندن «fx-customers» از localStorage دیگر انجام نمی‌شود.
 */
export async function sendReceiptAfterTransaction(
  data: ReceiptData,
  customerChatId?: string,
): Promise<{ sent: boolean; message: string }> {
  // 🔴 تنظیمات فقط از Firestore (کش مموری) — بدون localStorage و بدون نیاز به توکن در کلاینت
  const settings = getTelegramSettings();

  if (!settings.enabled) {
    return { sent: false, message: "تلگرام غیرفعال است" };
  }

  const receiptText = buildReceiptText(data);

  let sentToCustomer = false;
  let sentToExchange = false;

  // ارسال به مشتری (اگر chat_id شده باشد)
  if (customerChatId) {
    sentToCustomer = await sendTelegramMessage("", customerChatId, receiptText);
  }

  // ارسال به صرافی (chatId از تنظیمات Firestore)
  if (settings.chatId) {
    sentToExchange = await sendTelegramMessage("", settings.chatId, receiptText);
  }

  if (sentToCustomer || sentToExchange) {
    const targets = [];
    if (sentToCustomer) targets.push("مشتری");
    if (sentToExchange) targets.push("صرافی");
    return { sent: true, message: `رسید به ${targets.join(" و ")} ارسال شد` };
  }

  return { sent: false, message: "خطا در ارسال رسید" };
}
