"use client";

/* ==========================================================================
   ثابت‌های عمومی
   ========================================================================== */

/** لیست ارزهای پشتیبانی شده (برای انتخاب در فرم‌ها) */
export const CURRENCIES = ["افغانی", "دالر", "تومان", "یورو"];

/** لیست شهرهای پرکاربرد (مبدأ و مقصد حواله) */
export const CITIES = [
  "هرات",
  "مشهد",
  "کابل",
  "تهران",
  "مزار شریف",
  "قندهار",
  "اصفهان",
  "شیراز",
  "تبریز",
  "دبی",
  "استانبول",
];

/** نگاشت نام ارز به کد اختصاری (برای محاسبات) */
const CUR_MAP: Record<string, string> = {
  "افغانی": "AFN",
  "دالر": "USD",
  "تومان": "IRT",
  "یورو": "EUR",
};

/* ==========================================================================
   توابع تبدیل ارز
   ========================================================================== */

/** بارگذاری نرخ‌ها از localStorage (با مقدار پیش‌فرض) */
export function loadRates(): { usd: number; eur: number; toman: number } {
  try {
    const raw = localStorage.getItem("db_rates");
    if (!raw) return { usd: 70.5, eur: 76, toman: 0.64 };
    const parsed = JSON.parse(raw);
    return {
      usd: Number(parsed.usd) || 70.5,
      eur: Number(parsed.eur) || 76,
      toman: Number(parsed.toman) || 0.64,
    };
  } catch {
    return { usd: 70.5, eur: 76, toman: 0.64 };
  }
}

/** تبدیل مبلغ از ارز داده شده به افغانی (با نرخ‌های جاری) */
export function toAFN(amount: number, curName: string, rates: { usd: number; eur: number; toman: number }): number {
  const code = CUR_MAP[curName];
  if (!code || !Number.isFinite(amount)) return 0;
  switch (code) {
    case "IRT": // تومان: نرخ به ازای هر ۱۰۰ تومان
      return (amount / 100) * rates.toman;
    case "USD":
      return amount * rates.usd;
    case "EUR":
      return amount * rates.eur;
    default: // افغانی
      return amount;
  }
}

/** تبدیل مبلغ از افغانی به ارز هدف (با نرخ‌های جاری) */
export function fromAFN(amount: number, curName: string, rates: { usd: number; eur: number; toman: number }): number {
  const code = CUR_MAP[curName];
  if (!code || !Number.isFinite(amount)) return 0;
  switch (code) {
    case "IRT":
      return (amount / rates.toman) * 100;
    case "USD":
      return amount / rates.usd;
    case "EUR":
      return amount / rates.eur;
    default:
      return amount;
  }
}

/* ==========================================================================
   توابع کمکی
   ========================================================================== */

/** فرمت‌کننده اعداد به فارسی (با کاما) */
export function fa(n: number): string {
  if (!Number.isFinite(n)) return "۰";
  return n.toLocaleString("fa-IR", { maximumFractionDigits: 0 });
}

/** تاریخ امروز به شمسی (فرمت `YYYY/MM/DD`) */
export function todayFa(): string {
  return new Date().toLocaleDateString("fa-IR");
}

/** ساعت کنونی (HH:MM) */
export function timeNow(): string {
  return new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" });
}

/* ==========================================================================
   اعتبارسنجی فرم‌ها
   ========================================================================== */

export function checkRequired(
  form: Record<string, any>,
  fields: { key: string; label: string }[]
): string[] {
  const missing: string[] = [];
  for (const f of fields) {
    const val = form[f.key];
    if (val === undefined || val === null || String(val).trim() === "") {
      missing.push(f.label);
    }
  }
  return missing;
}

export function requiredMessage(missingLabels: string[]): string {
  return "لطفاً فیلدهای زیر را پر کنید: " + missingLabels.join("، ");
}

/* ==========================================================================
   تابع ساخت رسید (در صورت نیاز)
   ========================================================================== */

export function buildReceipt({
  receiptNo,
  customer,
  typeLabel,
  amountLabel,
  receiver,
  balances,
  balancesBefore,
  deductedAmount,
  exchangeRate,
  description,
  date,
  time,
  siteName,
}: {
  receiptNo: string;
  customer: string;
  typeLabel: string;
  amountLabel: string;
  receiver?: string;
  balances: { AFN?: number; USD?: number; IRR?: number };
  balancesBefore?: { AFN?: number; USD?: number; IRR?: number };
  deductedAmount?: number;
  exchangeRate?: number;
  description?: string;
  date?: string;
  time?: string;
  siteName?: string;
}): string {
  const d = date || todayFa();
  const t = time || timeNow();
  const site = siteName || "صرافی برادران نورزاد — هرات";

  let text =
    `🏦 ${site}\n` +
    `📋 شماره رسید: ${receiptNo}\n` +
    `📅 تاریخ: ${d}  ⏰ ${t}\n` +
    `👤 مشتری: ${customer}\n` +
    `📌 نوع معامله: ${typeLabel}\n` +
    `💰 ${amountLabel}\n`;

  if (receiver) text += `👤 گیرنده: ${receiver}\n`;
  if (exchangeRate) text += `💱 نرخ: ${fa(exchangeRate)} افغانی\n`;
  if (description) text += `📝 شرح: ${description}\n`;

  // مانده‌ها (قبل و بعد)
  if (balancesBefore) {
    text += `\n📊 مانده قبل:\n`;
    if (balancesBefore.AFN) text += `   افغانی: ${fa(balancesBefore.AFN)}\n`;
    if (balancesBefore.USD) text += `   دالر: ${fa(balancesBefore.USD)}\n`;
    if (balancesBefore.IRR) text += `   تومان: ${fa(balancesBefore.IRR)}\n`;
  }

  if (deductedAmount !== undefined && deductedAmount !== 0) {
    text += `🔻 کسر شده: ${fa(deductedAmount)} افغانی\n`;
  }

  text += `\n📊 مانده جدید:\n`;
  if (balances.AFN) text += `   افغانی: ${fa(balances.AFN)}\n`;
  if (balances.USD) text += `   دالر: ${fa(balances.USD)}\n`;
  if (balances.IRR) text += `   تومان: ${fa(balances.IRR)}\n`;

  text += `\n🔐 تأیید معامله\n` +
          `🙏 از همکاری شما سپاسگزاریم.`;

  return text;
}

/* ==========================================================================
   توابع کمکی برای شناسایی ارز اصلی و برچسب‌ها (برای رسید)
   ========================================================================== */

export function getMainCurrency(balances: { AFN?: number; USD?: number; IRR?: number }): string {
  if (balances.AFN) return "AFN";
  if (balances.USD) return "USD";
  if (balances.IRR) return "IRR";
  return "AFN";
}

export function getCurrencyLabel(code: string): string {
  const map: Record<string, string> = {
    AFN: "افغانی",
    USD: "دالر",
    IRR: "تومان",
    IRT: "تومان",
    EUR: "یورو",
  };
  return map[code] || code;
}

export function getCurrencyFlag(code: string): string {
  const map: Record<string, string> = {
    AFN: "🇦🇫",
    USD: "🇺🇸",
    IRR: "🇮🇷",
    IRT: "🇮🇷",
    EUR: "🇪🇺",
  };
  return map[code] || "";
}
