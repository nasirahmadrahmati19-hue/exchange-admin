export interface Rates { usd: string; eur: string; toman: string; }

export const defaultRates: Rates = { usd: "70.5", eur: "76", toman: "0.64" };
export const CURRENCIES = ["افغانی", "تومان", "دلار", "یورو"];
export const CITIES = ["هرات", "کابل", "اسلام‌قلعه", "مشهد", "تهران", "دوغارون"];

export function loadJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T; } catch {}
  return fallback;
}

export function loadRates(): Rates {
  return { ...defaultRates, ...loadJSON<Partial<Rates>>("db_rates", {}) };
}

export function loadCommission(): string {
  const s = loadJSON<any>("db_settings", {});
  return s && s.commission ? String(s.commission) : "0.5";
}

export function toAFN(amount: number, cur: string, rates: Rates): number {
  if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
  if (cur === "دلار") return amount * Number(rates.usd);
  if (cur === "یورو") return amount * Number(rates.eur);
  return amount;
}

export function fromAFN(afn: number, cur: string, rates: Rates): number {
  if (cur === "تومان") return (afn / Number(rates.toman)) * 1000;
  if (cur === "دلار") return afn / Number(rates.usd);
  if (cur === "یورو") return afn / Number(rates.eur);
  return afn;
}

export function fa(n: number): string {
  return n.toLocaleString("fa-IR", { maximumFractionDigits: 0 });
}

export function todayFa(): string {
  return new Date().toLocaleDateString("fa-IR");
}

export function checkRequired(form: Record<string, string>, required: { key: string; label: string }[]): string[] {
  const missing: string[] = [];
  required.forEach(r => { if (!(form[r.key] || "").trim()) missing.push(r.label); });
  return missing;
}

export function requiredMessage(missing: string[]): string {
  return "لطفاً این فیلدها را پر کنید: " + missing.join("، ");
}

export function statusChipClass(s: string): string {
  if (s === "در انتظار" || s === "باز") return "bg-amber-50 text-amber-700 border-amber-200";
  if (s === "ارسال شده") return "bg-blue-50 text-blue-700 border-blue-200";
  if (s === "تحویل شده" || s === "بسته" || s === "تأیید شده" || s === "فعال") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "رد شده" || s === "مسدود") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

/* ---------- اشتراک‌گذاری ---------- */

export function shareLinks(text: string, phone?: string) {
  const enc = encodeURIComponent(text);
  const cleanPhone = (phone || "").replace(/\D/g, "");
  return {
    whatsapp: `https://wa.me/${cleanPhone}?text=${enc}`,
    telegram: `https://t.me/share/url?url=&text=${enc}`,
    email: `mailto:?subject=${encodeURIComponent("صرافی برادران نورزاد")}&body=${enc}`,
    sms: `sms:${cleanPhone}?body=${enc}`,
  };
}

export function openPDF(title: string, rows: { label: string; value: string }[]) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const body = rows.map(r =>
    `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;width:35%;">${r.label}</td><td style="padding:8px;border:1px solid #ddd;">${r.value}</td></tr>`
  ).join("");
  w.document.write(`
    <html dir="rtl"><head><meta charset="utf-8"/><title>${title}</title>
    <style>body{font-family:Tahoma,sans-serif;padding:24px;color:#111;}h1{font-size:18px;margin:0;}p{color:#666;font-size:12px;}table{width:100%;border-collapse:collapse;margin-top:16px;}</style>
    </head><body>
    <h1>${title}</h1>
    <p>صرافی برادران نورزاد — هرات، افغانستان</p>
    <table>${body}</table>
    <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
    </body></html>
  `);
  w.document.close();
}
