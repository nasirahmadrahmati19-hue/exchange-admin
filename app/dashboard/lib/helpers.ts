export interface Rates { usd: string; eur: string; toman: string; }
export const defaultRates: Rates = { usd: "70.5", eur: "76", toman: "0.64" };
export const CURRENCIES = ["افغانی", "تومان", "دلار", "یورو"];
export const CITIES = ["هرات", "کابل", "اسلام‌قلعه", "مشهد", "تهران", "دوغارون"];

/* ---------- حساب‌ها ---------- */
export type CurKey = "AFN" | "USD" | "IRR";
export interface Balances { AFN: number; USD: number; IRR: number; }
export interface AccountUser { id: number; name: string; phone: string; telegram?: string; balances: Balances; status: string; }
export interface Tx {
  id: number; receiptNo: string; typeLabel: string; customer: string; receiver: string;
  currency: string; amount: number; afnValue: string; status: string; date: string; time: string;
  balancesAfter: Balances; phone: string;
}

export const CURRENCY_META: Record<CurKey, { label: string; flag: string; code: string }> = {
  AFN: { label: "افغانی", flag: "🇦🇫", code: "AFN" },
  USD: { label: "دالر", flag: "🇺🇸", code: "USD" },
  IRR: { label: "تومان", flag: "🇮🇷", code: "IRR" },
};

export function emptyBalances(): Balances { return { AFN: 0, USD: 0, IRR: 0 }; }

/* ---------- ذخیره ---------- */
export function loadJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T; } catch {}
  return fallback;
}
export function loadRates(): Rates { return { ...defaultRates, ...loadJSON<Partial<Rates>>("db_rates", {}) }; }
export function loadCommission(): string { const s = loadJSON<any>("db_settings", {}); return s && s.commission ? String(s.commission) : "0.5"; }
export function loadSiteName(): string { const s = loadJSON<any>("db_settings", {}); return s && s.siteName ? s.siteName : "برادران نورزاد"; }

/* ---------- تبدیل ارز ---------- */
export function toAFN(amount: number, cur: string, rates: Rates): number {
  if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
  if (cur === "دلار" || cur === "دالر") return amount * Number(rates.usd);
  if (cur === "یورو") return amount * Number(rates.eur);
  return amount;
}
export function fromAFN(afn: number, cur: string, rates: Rates): number {
  if (cur === "تومان") return (afn / Number(rates.toman)) * 1000;
  if (cur === "دلار" || cur === "دالر") return afn / Number(rates.usd);
  if (cur === "یورو") return afn / Number(rates.eur);
  return afn;
}
export function toAFNk(amt: number, k: CurKey, r: Rates): number {
  if (k === "AFN") return amt;
  if (k === "USD") return amt * Number(r.usd);
  return (amt / 1000) * Number(r.toman);
}
export function fromAFNk(afn: number, k: CurKey, r: Rates): number {
  if (k === "AFN") return afn;
  if (k === "USD") return afn / Number(r.usd);
  return (afn / Number(r.toman)) * 1000;
}

/* ---------- قالب ---------- */
export function fa(n: number): string { return n.toLocaleString("fa-IR", { maximumFractionDigits: 0 }); }
export function todayFa(): string { return new Date().toLocaleDateString("fa-IR"); }
export function nowTime(): string { return new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }); }

/* ---------- اعتبارسنجی ---------- */
export function checkRequired(form: Record<string, string>, required: { key: string; label: string }[]): string[] {
  const missing: string[] = [];
  required.forEach(r => { if (!(form[r.key] || "").trim()) missing.push(r.label); });
  return missing;
}
export function requiredMessage(missing: string[]): string { return "لطفاً این فیلدها را پر کنید: " + missing.join("، "); }

export function statusChipClass(s: string): string {
  if (s === "در انتظار" || s === "باز") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "ارسال شده") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "تحویل شده" || s === "بسته" || s === "تأیید شده" || s === "فعال" || s === "موفق") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "رد شده" || s === "مسدود") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

/* ---------- موتور حسابداری ---------- */
export function nextReceiptNo(): string {
  let n = 1024;
  try { const s = localStorage.getItem("db_receipt_counter"); if (s) n = Number(s); } catch {}
  n += 1;
  try { localStorage.setItem("db_receipt_counter", String(n)); } catch {}
  return "#TR-" + n;
}

export function applyTransfer(user: AccountUser, cur: CurKey, amount: number): AccountUser {
  const balances = { ...user.balances, [cur]: (user.balances[cur] || 0) - amount };
  return { ...user, balances };
}

export function applyExchange(user: AccountUser, fromCur: CurKey, toCur: CurKey, fromAmount: number, toAmount: number): AccountUser {
  const balances = {
    ...user.balances,
    [fromCur]: (user.balances[fromCur] || 0) - fromAmount,
    [toCur]: (user.balances[toCur] || 0) + toAmount,
  };
  return { ...user, balances };
}

/* ---------- توابع کمکی برای رسید ---------- */
function getMainCurrency(amountLabel: string): string {
  const match = amountLabel.match(/(AFN|USD|IRR)/);
  if (match) return match[1];
  if (amountLabel.includes("افغانی")) return "AFN";
  if (amountLabel.includes("دالر") || amountLabel.includes("دلار")) return "USD";
  if (amountLabel.includes("تومان")) return "IRR";
  return "AFN";
}

function getCurrencyLabel(currency: string): string {
  if (currency === "AFN") return "افغانی";
  if (currency === "USD") return "دالر";
  if (currency === "IRR") return "تومان";
  return "افغانی";
}

function getCurrencyFlag(currency: string): string {
  if (currency === "AFN") return "🇦🇫";
  if (currency === "USD") return "🇺🇸";
  if (currency === "IRR") return "🇮🇷";
  return "💰";
}

/* ---------- ساخت رسید رسمی ---------- */
export function buildReceipt(o: {
  receiptNo: string;
  customer: string;
  typeLabel: string;
  amountLabel: string;
  receiver: string;
  balances: Balances;
  balancesBefore?: Balances;
  deductedAmount?: number;
  deductedCurrency?: string;
  exchangeRate?: string;
  description?: string;
  date: string;
  time: string;
  siteName: string;
}): string {
  const LINE = "━━━━━━━━━━━━━━━━━━━━";
  const settings = loadJSON<any>("db_settings", {});
  const siteName = o.siteName || settings.siteName || "صرافی برادران نورزاد";
  const receiptNoClean = o.receiptNo.replace("#", "");

  const exchangeRate = o.exchangeRate || "—";
  const description = o.description || "انتقال وجه به گیرنده";

  const mainCurrency = getMainCurrency(o.amountLabel);
  const mainCurrencyLabel = getCurrencyLabel(mainCurrency);
  const mainCurrencyFlag = getCurrencyFlag(mainCurrency);

  const amountNum = Number(o.amountLabel.replace(/[^\d]/g, "")) || 0;
  const deductedCurrencyLabel = o.deductedCurrency || mainCurrencyLabel;

  const lines: string[] = [];

  lines.push("🧾 رسید معامله صرافی");
  lines.push("");
  lines.push("🏦 " + siteName);
  lines.push("");
  lines.push(LINE);
  lines.push("");
  lines.push("📋 اطلاعات معامله");
  lines.push("");
  lines.push("شماره رسید: " + receiptNoClean);
  lines.push("تاریخ: " + o.date);
  lines.push("ساعت: " + o.time);
  lines.push("نام مشتری: " + o.customer);
  lines.push("نوع معامله: " + o.typeLabel);
  lines.push("گیرنده: " + o.receiver);
  lines.push("");
  lines.push(LINE);
  lines.push("");
  lines.push("💰 جزئیات مالی");
  lines.push("");
  lines.push("مبلغ اصلی: " + fa(amountNum) + " " + mainCurrencyLabel);
  lines.push("نرخ معامله: " + exchangeRate);
  lines.push("مبلغ نهایی: " + fa(amountNum) + " " + mainCurrencyLabel);
  lines.push("وضعیت: ✅ موفق");
  lines.push("");
  lines.push(LINE);
  lines.push("");
  lines.push("📊 مانده حساب");
  lines.push("");

  if (o.balancesBefore) {
    lines.push("مانده قبل از معامله:");
    lines.push("🇦🇫 افغانی: " + fa(o.balancesBefore.AFN) + " AFN");
    lines.push("");
  }

  if (o.deductedAmount && o.deductedAmount > 0) {
    lines.push("مبلغ کسرشده:");
    lines.push(mainCurrencyFlag + " " + mainCurrencyLabel + ": " + fa(o.deductedAmount) + " " + deductedCurrencyLabel);
    lines.push("");
  }

  lines.push("مانده پس از معامله:");
  lines.push("🇦🇫 افغانی: " + fa(o.balances.AFN) + " AFN");
  lines.push("🇺🇸 دالر: " + fa(o.balances.USD) + " USD");
  lines.push("🇮🇷 تومان: " + fa(o.balances.IRR) + " IRR");
  lines.push("");
  lines.push(LINE);
  lines.push("");
  lines.push("📝 شرح معامله");
  lines.push("");
  lines.push("شرح: " + description);
  lines.push("گیرنده: " + o.receiver);
  lines.push("توضیحات اضافی: —");
  lines.push("");
  lines.push(LINE);
  lines.push("");
  lines.push("🔐 تأیید معامله");
  lines.push("");
  lines.push("کد پیگیری: " + receiptNoClean);
  lines.push("وضعیت ثبت: ✅ ثبت‌شده و تأییدشده");
  lines.push("");
  lines.push("این رسید نشان‌دهنده ثبت موفق معامله در");
  lines.push("سیستم " + siteName + " می‌باشد.");
  lines.push("");
  lines.push("🙏 تشکر از اعتماد شما");
  lines.push("");
  lines.push(siteName);

  return lines.join("\n");
}

/* ---------- اشتراک ---------- */
export function shareLinks(text: string, phone?: string) {
  const enc = encodeURIComponent(text);
  const cleanPhone = (phone || "").replace(/\D/g, "");
  return {
    whatsapp: "https://wa.me/" + cleanPhone + "?text=" + enc,
    telegram: "https://t.me/share/url?url=&text=" + enc,
    email: "mailto:?subject=" + encodeURIComponent("صرافی برادران نورزاد") + "&body=" + enc,
    sms: "sms:" + cleanPhone + "?body=" + enc,
  };
}

export function openPDF(title: string, rows: { label: string; value: string }[]) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const body = rows.map(r => '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;width:35%;">' + r.label + '</td><td style="padding:8px;border:1px solid #ddd;">' + r.value + '</td></tr>').join("");
  w.document.write('<html dir="rtl"><head><meta charset="utf-8"/><title>' + title + '</title><style>body{font-family:Tahoma,sans-serif;padding:24px;}h1{font-size:18px;}p{color:#666;font-size:12px;}table{width:100%;border-collapse:collapse;margin-top:16px;}</style></head><body><h1>' + title + '</h1><p>صرافی برادران نورزاد — هرات</p><table>' + body + '</table><script>window.onload=function(){setTimeout(function(){window.print();},300);}</script></body></html>');
  w.document.close();
}
