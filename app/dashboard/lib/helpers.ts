export interface Rates { usd: string; eur: string; toman: string; }

export const defaultRates: Rates = { usd: "70.5", eur: "76", toman: "0.64" };

export const CURRENCIES = ["افغانی", "تومان", "دلار", "یورو"];
export const CITIES = ["هرات", "کابل", "اسلام‌قلعه", "مشهد", "تهران", "دوغارون"];

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s) as T;
  } catch {}
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
