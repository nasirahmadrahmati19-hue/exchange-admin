"use client";

import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { title: "داشبورد", href: "/dashboard" },
  { title: "حواله‌جات", href: "/dashboard/hawala" },
  { title: "تبادل ارز", href: "/dashboard/trades" },
  { title: "صندوق", href: "/dashboard/cash" },
  { title: "مشتریان", href: "/dashboard/users" },
  { title: "تیکت‌ها", href: "/dashboard/tickets" },
];

// ===== کلیدهای localStorage =====
const CUSTOMERS_KEY = "fx-customers";
const TRANSACTIONS_KEY = "fx-transactions";
const HAWALAS_KEY = "fx-hawalas";
const CASH_KEY = "fx-cash";
const SETTINGS_KEY = "fx-settings";

type Settings = {
  email: string;
  supportEmail: string;
  language: "dari" | "pashto" | "english";
  teamName: string;
  teamAddress: string;
  teamPhone: string;
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    notifyNewHawala: boolean;
    notifySettlement: boolean;
    notifyVoid: boolean;
    notifyExchange: boolean;
  };
};

const defaultSettings: Settings = {
  email: "", supportEmail: "", language: "dari",
  teamName: "صرافی برادران نورزاد", teamAddress: "هرات، افغانستان", teamPhone: "",
  telegram: { enabled: false, botToken: "", chatId: "", notifyNewHawala: true, notifySettlement: true, notifyVoid: true, notifyExchange: true },
};

const loadSettings = (): Settings => {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed, telegram: { ...defaultSettings.telegram, ...parsed.telegram } };
  } catch { return defaultSettings; }
};

const saveSettings = (s: Settings) => {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
};

// ===== آیکون‌ها =====
const Ic = ({ n, className = "h-5 w-5" }: { n: string; className?: string }) => {
  const paths: Record<string, string> = {
    gear: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    mail: "M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75",
    globe: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
    users: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
    backup: "M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125",
    telegram: "M6 12 3.269 3.126A59.768 59.768 0 0 1 21.485 12 59.77 59.77 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5",
    x: "M6 18 18 6M6 6l12 12",
    check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    download: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5",
    upload: "M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 16.5V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3",
    chevron: "m19.5 8.25-7.5 7.5-7.5-7.5",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={paths[n] || ""} /></svg>;
};

// ===== کامپوننت پنل تنظیمات =====
function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [toast, setToast] = useState("");
  const [activeAccordion, setActiveAccordion] = useState<string | null>("email");
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSettings(loadSettings()); setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-settings-toggle]")) onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };
  const updateSettings = (u: Partial<Settings>) => setSettings(p => { const n = { ...p, ...u }; saveSettings(n); return n; });
  const updateTelegram = (u: Partial<Settings["telegram"]>) => setSettings(p => { const n = { ...p, telegram: { ...p.telegram, ...u } }; saveSettings(n); return n; });

  const handleBackup = () => {
    try {
      const data = {
        version: "1.0", exportDate: new Date().toISOString(), settings: loadSettings(),
        customers: JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || "[]"),
        transactions: JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || "[]"),
        hawalas: JSON.parse(localStorage.getItem(HAWALAS_KEY) || "[]"),
        cashEntries: JSON.parse(localStorage.getItem(CASH_KEY) || "[]"),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("پشتیبان دانلود شد");
    } catch { showToast("خطا در پشتیبان‌گیری"); }
  };

  const handleRestore = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.customers) localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(data.customers));
        if (data.transactions) localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(data.transactions));
        if (data.hawalas) localStorage.setItem(HAWALAS_KEY, JSON.stringify(data.hawalas));
        if (data.cashEntries) localStorage.setItem(CASH_KEY, JSON.stringify(data.cashEntries));
        if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
        showToast("بازیابی شد. صفحه رفرش می‌شود...");
        setTimeout(() => window.location.reload(), 2000);
      } catch { showToast("خطا در خواندن فایل"); }
    };
    reader.readAsText(file);
  };

  if (!mounted) return null;

  const uiInput = "h-11 w-full px-3.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/10 text-sm";
  const uiLabel = "mb-1.5 block text-[11px] font-black text-slate-400";
  const fld = (l: string, n: ReactNode) => (<div><label className={uiLabel}>{l}</label>{n}</div>);

  const AccordionItem = ({ id, icon, title, children }: { id: string; icon: string; title: string; children: ReactNode }) => {
    const isOpen = activeAccordion === id;
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
        <button onClick={() => setActiveAccordion(isOpen ? null : id)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 hover:bg-slate-700/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300"><Ic n={icon} className="h-4 w-4" /></span>
            <span className="text-sm font-black text-white">{title}</span>
          </div>
          <Ic n="chevron" className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
        </button>
        <div className={`transition-all duration-300 overflow-hidden ${isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-4 pb-4 pt-2 border-t border-slate-700">{children}</div>
        </div>
      </div>
    );
  };

  const Toggle = ({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) => (
    <button type="button" onClick={() => onChange(!enabled)} className="flex items-center gap-3 cursor-pointer">
      <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-slate-600"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${enabled ? "-translate-x-1" : "-translate-x-6"}`} />
      </span>
      {label && <span className="text-sm font-bold text-slate-200">{label}</span>}
    </button>
  );

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[55]" onClick={onClose} />}
      <div
        ref={panelRef}
        className={`fixed top-0 left-0 z-[60] h-full w-full max-w-md transform transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"} bg-slate-900 border-r border-slate-700 shadow-2xl overflow-y-auto`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 px-5 py-4 backdrop-blur bg-slate-900/95">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Ic n="gear" className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black text-white">تنظیمات</h2>
              <p className="text-[10px] font-bold text-slate-500">پیکربندی سیستم صرافی</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-700 text-slate-400"><Ic n="x" className="h-5 w-5" /></button>
        </div>

        <div className="space-y-3 p-4">
          <AccordionItem id="email" icon="mail" title="ایمیل (جیمیل)">
            <div className="space-y-3">
              {fld("ایمیل صرافی", <input type="email" dir="ltr" value={settings.email} onChange={e => updateSettings({ email: e.target.value })} placeholder="example@gmail.com" className={`${uiInput} text-left`} />)}
              {fld("ایمیل پشتیبانی", <input type="email" dir="ltr" value={settings.supportEmail} onChange={e => updateSettings({ supportEmail: e.target.value })} placeholder="support@gmail.com" className={`${uiInput} text-left`} />)}
              <button onClick={() => { saveSettings(settings); showToast("ذخیره شد"); }} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white hover:bg-emerald-600 active:scale-95">
                <Ic n="check" className="h-4 w-4" />ذخیره ایمیل
              </button>
            </div>
          </AccordionItem>

          <AccordionItem id="language" icon="globe" title="زبان سیستم">
            <div className="space-y-2">
              {([
                { value: "dari", label: "دری (فارسی)", flag: "🇦🇫" },
                { value: "pashto", label: "پشتو", flag: "🇦🇫" },
                { value: "english", label: "English", flag: "🇬🇧" },
              ] as const).map(lang => (
                <button key={lang.value} onClick={() => { updateSettings({ language: lang.value }); showToast(`زبان: ${lang.label}`); }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition-all ${settings.language === lang.value ? "border-emerald-400 bg-emerald-400/10" : "border-slate-600 hover:border-slate-500"}`}>
                  <span className="text-xl">{lang.flag}</span>
                  <span className="flex-1 text-right text-sm font-bold text-white">{lang.label}</span>
                  {settings.language === lang.value && <Ic n="check" className="h-5 w-5 text-emerald-300" />}
                </button>
              ))}
            </div>
          </AccordionItem>

          <AccordionItem id="team" icon="users" title="اطلاعات تیم">
            <div className="space-y-3">
              {fld("نام تیم / صرافی", <input value={settings.teamName} onChange={e => updateSettings({ teamName: e.target.value })} placeholder="صرافی برادران نورزاد" className={uiInput} />)}
              {fld("آدرس", <input value={settings.teamAddress} onChange={e => updateSettings({ teamAddress: e.target.value })} placeholder="هرات، افغانستان" className={uiInput} />)}
              {fld("شماره تماس", <input dir="ltr" value={settings.teamPhone} onChange={e => updateSettings({ teamPhone: e.target.value })} placeholder="+93 700 000 000" className={`${uiInput} text-left`} />)}
              <button onClick={() => { saveSettings(settings); showToast("ذخیره شد"); }} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white hover:bg-emerald-600 active:scale-95">
                <Ic n="check" className="h-4 w-4" />ذخیره اطلاعات تیم
              </button>
            </div>
          </AccordionItem>

          <AccordionItem id="backup" icon="backup" title="پشتیبان‌گیری">
            <div className="space-y-3">
              <button onClick={handleBackup} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white hover:bg-emerald-600 active:scale-95">
                <Ic n="download" className="h-4 w-4" />دانلود پشتیبان کامل
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-600 text-slate-200 text-sm font-black hover:bg-slate-700 active:scale-95">
                <Ic n="upload" className="h-4 w-4" />بازیابی از فایل
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.target.value = ""; }} />
              <div className="rounded-lg p-3 text-[11px] font-bold bg-slate-700/50 text-slate-400">💡 شامل تمام مشتریان، معاملات، حواله‌ها و اسناد صندوق</div>
            </div>
          </AccordionItem>

          <AccordionItem id="telegram" icon="telegram" title="تنظیمات تلگرام">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">فعال‌سازی تلگرام</span>
                <Toggle enabled={settings.telegram.enabled} onChange={v => updateTelegram({ enabled: v })} />
              </div>
              {settings.telegram.enabled && (
                <>
                  {fld("توکن بات", <input dir="ltr" value={settings.telegram.botToken} onChange={e => updateTelegram({ botToken: e.target.value })} placeholder="123456789:ABCdef..." className={`${uiInput} text-left font-mono text-xs`} />)}
                  {fld("چت آی‌دی", <input dir="ltr" value={settings.telegram.chatId} onChange={e => updateTelegram({ chatId: e.target.value })} placeholder="-1001234567890" className={`${uiInput} text-left font-mono text-xs`} />)}
                  <div className="rounded-xl border border-slate-600 p-3 space-y-3">
                    <p className="text-xs font-black text-white">اعلان‌ها:</p>
                    <Toggle enabled={settings.telegram.notifyNewHawala} onChange={v => updateTelegram({ notifyNewHawala: v })} label="حواله جدید" />
                    <Toggle enabled={settings.telegram.notifySettlement} onChange={v => updateTelegram({ notifySettlement: v })} label="تسویه حواله" />
                    <Toggle enabled={settings.telegram.notifyVoid} onChange={v => updateTelegram({ notifyVoid: v })} label="لغو حواله" />
                    <Toggle enabled={settings.telegram.notifyExchange} onChange={v => updateTelegram({ notifyExchange: v })} label="تبادل ارز" />
                  </div>
                  <button onClick={() => { saveSettings(settings); showToast("ذخیره شد"); }} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-white hover:bg-emerald-600 active:scale-95">
                    <Ic n="check" className="h-4 w-4" />ذخیره تنظیمات تلگرام
                  </button>
                </>
              )}
            </div>
          </AccordionItem>

          <div className="mt-4 rounded-xl p-4 text-center bg-slate-800/50">
            <p className="text-[10px] font-bold text-slate-500">نسخه ۱.۰.۰ — صرافی برادران نورزاد</p>
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-black shadow-lg bg-emerald-500 text-white">{toast}</div>}
    </>
  );
}

// ===== Layout اصلی =====
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("isAuthenticated") !== "true") {
      router.push("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    router.push("/");
  };

  return (
    <div className="min-h-screen">
      {/* ===== آیکن تنظیمات شناور - بالا سمت چپ ===== */}
      <button
        data-settings-toggle
        onClick={() => setSettingsOpen(true)}
        className="fixed top-24 left-4 z-[9999] grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/50 hover:scale-110 active:scale-95 transition-all duration-300 ring-2 ring-white/20"
        title="تنظیمات"
      >
        <Ic n="gear" className={`h-6 w-6 transition-transform duration-500 ${settingsOpen ? "rotate-90" : ""}`} />
      </button>

      {/* ===== پنل تنظیمات ===== */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* ===== هدر اصلی ===== */}
      <header className="sticky top-0 z-50 shadow-lg">
        <div className="bg-[#0b1f2e] text-white">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center text-[#0b1f2e] font-extrabold">ن</div>
              <div>
                <span className="text-[#e3b45c] text-[11px] font-bold block">صرافی و حواله‌جات</span>
                <h1 className="font-extrabold text-base leading-5">برادران نورزاد — هرات</h1>
              </div>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 rounded-xl hover:bg-red-500/20 text-red-300 text-sm font-bold">خروج</button>
          </div>
        </div>

        <div className="bg-[#0f2839]">
          <nav className="max-w-7xl mx-auto px-2 flex items-end overflow-x-auto">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={`px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${active ? "bg-[#f6f4ee] text-[#0b1f2e] border-[#d9a441]" : "text-slate-300 hover:text-[#e3b45c] border-transparent"}`}>
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>

      <footer className="max-w-7xl mx-auto px-4 pb-8 text-center text-xs text-slate-400">
        © ۱۴۰۵ صرافی برادران نورزاد — هرات، افغانستان
      </footer>
    </div>
  );
}
