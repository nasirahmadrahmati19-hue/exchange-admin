"use client";

/**
 * 🔴 قالب استاندارد اشتراک‌گذاری اسناد مالی
 * مورد استفاده در: تب حواله (hawala) و تب تبادل ارز (trades)
 *
 * قالب خروجی (عیناً مطابق درخواست مشتری):
 *
 * 🔴 سند برد
 * 🗓 تاریخ: 1405/06/23 8:11 AM
 * 🛅 کد پیگیری: TR-1405-00417
 * 👤 مشتری: ...
 * 📑 شرح: ...
 * 💰 مبلغ: 50,000 دالر
 * 📝 به حروف: پنجاه هزار
 * -------------بیلانس فعلی شما--------------
 * افغانی: 40,000 طلب
 * دالر: 150,000 طلب
 * یورو: 0
 * تومان: 0
 * کلدار: 0
 * 🏦 صرافی برادران نورزاد — هرات
 */

// =========================
// تبدیل عدد به حروف فارسی
// =========================
const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES: [number, string][] = [
  [1_000_000_000_000, "میلیارد"], // میلیارد (10^12)
  [1_000_000_000, "میلیار"], // میلیار (10^9)
  [1_000_000, "میلیون"],
  [1_000, "هزار"],
];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest <= 19) parts.push(TEENS[rest - 10]);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t > 0) parts.push(TENS[t]);
    if (u > 0) parts.push(ONES[u]);
  }
  return parts.join(" و ");
}

/** تبدیل عدد (حداکثر تا تراخیون‌ها) به حروف فارسی. مثال: 50000 -> «پنجاه هزار» */
export function convertNumberToPersianWords(num: number): string {
  if (!Number.isFinite(num)) return "صفر";
  const negative = num < 0;
  let n = Math.abs(Math.floor(num));
  if (n === 0) return "صفر";

  const groups: string[] = [];
  for (const [value, name] of SCALES) {
    if (n >= value) {
      const count = Math.floor(n / value);
      n %= value;
      const words = threeDigitsToWords(count);
      groups.push(name === "هزار" && count === 1 ? "هزار" : `${words} ${name}`);
    }
  }
  if (n > 0) groups.push(threeDigitsToWords(n));

  const result = groups.join(" و ");
  return negative ? `منفی ${result}` : result;
}

// =========================
// اعداد فارسی با جداکننده هزارگان
// =========================
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toPersianDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]).replace(/,/g, "٬");
}

/** تبدیل عدد یا رشته به عدد فارسی با جداکننده هزارگان. مثال: 50000 -> «۵۰٬۰۰۰» */
export function formatPersianNumber(val: number | string): string {
  const n = typeof val === "string" ? Number(val.replace(/[^0-9.\-]/g, "")) : val;
  if (!Number.isFinite(n)) return "۰";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  return toPersianDigits(formatted);
}

// =========================
// تاریخ شمسی + ساعت ۱۲ ساعته AM/PM
// =========================
function shamsiParts(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value || "0";
    return `${g("year")}/${g("month")}/${g("day")}`;
  } catch {
    return "-";
  }
}

function time12Hour(d: Date): string {
  let h = d.getHours() % 12;
  if (h === 0) h = 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  return `${h}:${m} ${ampm}`;
}

/** تبدیل تاریخ ISO به «۱۴۰۵/۰۶/۲۳ 8:11 AM» */
export function formatShamsiDateTime(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "-";
  return `${shamsiParts(d)} ${time12Hour(d)}`;
}

// =========================
// انواع داده
// =========================
export type ShareTxType = "withdraw" | "deposit" | "hawala" | "exchange";

export interface ShareTransaction {
  trackingCode?: string;
  number?: string;
  date?: string;
  customerName?: string;
  senderName?: string;
  receiverName?: string;
  description?: string;
  destinationText?: string;
  note?: string;
  amount?: number;
  currencyLabel?: string;
}

export interface ShareBalance {
  AFN?: number;
  USD?: number;
  EUR?: number;
  IRR?: number;
  PKR?: number;
}

const TYPE_HEADER: Record<ShareTxType, string> = {
  withdraw: "🔴 سند برد",
  deposit: "🟢 سند واریز",
  hawala: "🔵 سند حواله",
  exchange: "🔵 سند مبادله",
};

const BALANCE_ROWS: { key: keyof ShareBalance; label: string }[] = [
  { key: "AFN", label: "افغانی" },
  { key: "USD", label: "دالر" },
  { key: "EUR", label: "یورو" },
  { key: "IRR", label: "تومان" },
  { key: "PKR", label: "کلدار" },
];

// =========================
// ساخت متن کامل سند
// =========================
/**
 * تولید متن دقیق سند مطابق قالب استاندارد.
 * @param tx اطلاعات تراکنش
 * @param balance بیلانس لحظه‌ای مشتری (منفی = طلب، مثبت = دهی)
 * @param type نوع سند: withdraw | deposit | hawala | exchange
 */
export function generateShareText(tx: ShareTransaction, balance: ShareBalance, type: ShareTxType): string {
  const header = TYPE_HEADER[type] || TYPE_HEADER.withdraw;
  const dateStr = tx.date ? formatShamsiDateTime(tx.date) : "-";
  const tracking = tx.trackingCode || tx.number || "-";
  const customer = tx.customerName || tx.senderName || "-";

  // 🔴 شرح حواله: همیشه مطابق قالب استاندارد
  // «ارسال حواله به [نام گیرنده] — [شهر] — [ناحیه]»
  let description = tx.description || "";
  if (type === "hawala") {
    description = tx.receiverName
      ? `ارسال حواله به ${tx.receiverName}${tx.destinationText ? ` — ${tx.destinationText}` : ""}`
      : (tx.destinationText || tx.note || "-");
  } else {
    if (!description && tx.destinationText) description = tx.destinationText;
    if (!description && tx.note) description = tx.note;
    if (!description) description = "-";
  }

  const amount = Number.isFinite(tx.amount as number) ? (tx.amount as number) : 0;
  // مبلغ با جداکننده هزارگان لاتین و قلم LTR دقیقاً مثل نمونه: "50,000 دالر"
  const amountStr = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
  const words = convertNumberToPersianWords(amount);
  const currency = tx.currencyLabel || "";

  const balanceLines = BALANCE_ROWS.map(({ key, label }) => {
    const raw = Number(balance?.[key] ?? 0);
    const rounded = Math.round((raw + Number.EPSILON) * 100) / 100;
    const numStr = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Math.abs(rounded));
    if (rounded < 0) return `${label}: ${numStr} طلب`; // مشتری طلب دارد (منفی در سیستم)
    if (rounded > 0) return `${label}: ${numStr} دهی`; // مشتری بدهکار است (مثبت در سیستم)
    return `${label}: 0`;
  });

  return [
    header,
    "",
    `🗓 تاریخ: ${dateStr}`,
    `🛅 کد پیگیری: ${tracking}`,
    `👤 مشتری: ${customer}`,
    `📑 شرح: ${description}`,
    // 🔴 مبلغ با قلم LTR تا جداکننده هزارگان و ترتیب «عدد ارز» دقیقاً مثل نمونه باشد
    `💰 مبلغ: \u200E${amountStr} ${currency}\u200F`,
    `📝 به حروف: ${words}`,
    "",
    "-------------بیلانس فعلی شما--------------",
    ...balanceLines.map((line) => {
      const idx = line.indexOf(":");
      const label = line.slice(0, idx);
      const value = line.slice(idx + 1).trim();
      return `${label}: \u200E${value}\u200F`;
    }),
    "",
    "🏦 صرافی برادران نورزاد — هرات",
  ].join("\n");
}

// =========================
// اشتراک‌گذاری / کپی
// =========================
/**
 * در موبایل منوی اشتراک گوشی (Web Share API) باز می‌شود؛
 * در دسکتاپ یا مرورگرهای بدون پشتیبانی، متن در کلیپ‌بورد کپی شده و
 * Toast «متن کپی شد» نمایش داده می‌شود.
 */
export async function handleShare(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: "صرافی برادران نورزاد", text });
      return "shared";
    }
  } catch (err) {
    // اگر کاربر از منوی اشتراک خارج شد (AbortError) کاری نمی‌کنیم
    if (err instanceof DOMException && err.name === "AbortError") return "failed";
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showToastFallback("✅ متن کپی شد");
      return "copied";
    }
  } catch {
    /* fallback پایین‌تر */
  }
  // فال‌بک نهایی برای محیط‌های قدیمی
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToastFallback("✅ متن کپی شد");
    return "copied";
  } catch {
    return "failed";
  }
}

/** Toast سبک و مستقل — اگر صفحه toast سفارشی خود را دارد، همان استفاده می‌شود */
function showToastFallback(message: string) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = message;
  el.setAttribute("dir", "rtl");
  el.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;" +
    "background:rgba(17,17,17,.92);color:#fff;padding:12px 22px;border-radius:14px;" +
    "font-family:Vazirmatn,Tahoma,sans-serif;font-size:14px;font-weight:700;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.35);backdrop-filter:blur(8px);transition:opacity .3s";
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 350);
  }, 2200);
}
