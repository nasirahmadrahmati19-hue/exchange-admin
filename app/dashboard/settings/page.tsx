"use client";

import { useState, useEffect, useRef } from "react";
import { useStored, Field, ErrorBox } from "../lib/ui";
import { loadJSON, fa } from "../lib/helpers";
import { sendTelegram, getLastChatId, getTelegramUsers, getBotInfo } from "../lib/telegram";

interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  lastSeen: string;
  lastMessage?: string;
}

// کلیدهای localStorage برای بکاپ
const BACKUP_KEYS = [
  "fx-customers",
  "fx-transactions",
  "hawalas",
  "cash-entries",
  "db_settings",
  "db_telegram_users",
  "telegram-bot-token",
  "tracking-code-counter",
  "hawalaLastNames",
  "fx-theme",
];

export default function SettingsPage() {
  const [settings, setSettings] = useStored<any>("db_settings", {
    siteName: "صرافی برادران نورزاد",
    address: "هرات، افغانستان",
    phone: "+93 700 000 000",
    telegramToken: "",
    telegramChatId: "",
    telegramSilent: false,
    username: "admin",
    password: "admin123",
  });

  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState("");
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [botInfo, setBotInfo] = useState<any>(null);
  const [backupStats, setBackupStats] = useState<Record<string, number>>({});

  const [openSections, setOpenSections] = useState({
    general: true,
    telegram: false,
    security: false,
    backup: false,
    about: false,
  });

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = window.localStorage.getItem("fx-theme");
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("fx-theme", theme); } catch {}
  }, [theme]);
  const dk = theme === "dark";

  useEffect(() => {
    try {
      const stored = localStorage.getItem("db_telegram_users");
      if (stored) setTelegramUsers(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (settings.telegramToken) {
      getBotInfo(settings.telegramToken).then(info => setBotInfo(info)).catch(() => setBotInfo(null));
    } else {
      setBotInfo(null);
    }
  }, [settings.telegramToken]);

  useEffect(() => {
    const stats: Record<string, number> = {};
    for (const key of BACKUP_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) { stats[key] = 0; continue; }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) stats[key] = parsed.length;
        else if (typeof parsed === "object") stats[key] = Object.keys(parsed).length;
        else stats[key] = 1;
      } catch { stats[key] = 0; }
    }
    setBackupStats(stats);
  }, [openSections.backup]);

  const set = (patch: any) => {
    setSettings({ ...settings, ...patch });
    setError("");
    setSuccess("");
  };

  const toggle = (key: keyof typeof openSections) => {
    setOpenSections(p => ({ ...p, [key]: !p[key] }));
  };

  const saveSettings = () => {
    try {
      setSettings(settings);
      setSuccess("✅ تنظیمات با موفقیت ذخیره شد");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("❌ خطا در ذخیره تنظیمات");
    }
  };

  const testTelegram = async () => {
    if (!settings.telegramToken?.trim()) { setError("⚠️ توکن ربات خالی است"); return; }
    if (!settings.telegramChatId?.trim()) { setError("⚠️ chat_id را دریافت کنید"); return; }
    setLoading(true);
    setTestResult("");
    try {
      const message = `🎉 تست اتصال ربات تلگرام\n\nصرافی: ${settings.siteName || "برادران نورزاد"}\nتاریخ: ${new Date().toLocaleDateString("fa-IR")}\nساعت: ${new Date().toLocaleTimeString("fa-IR")}\n\n✅ ربات شما فعال است!`;
      const ok = await sendTelegram(settings.telegramToken, settings.telegramChatId, message, { silent: settings.telegramSilent === true });
      setTestResult(ok ? "✅ پیام تست ارسال شد" : "❌ ارسال ناموفق بود");
    } catch (e) {
      setTestResult("❌ خطا: " + String(e));
    }
    setLoading(false);
  };

  const fetchChatId = async () => {
    if (!settings.telegramToken?.trim()) { setError("⚠️ توکن ربات خالی است"); return; }
    setLoading(true);
    setError("");
    try {
      const chatId = await getLastChatId(settings.telegramToken);
      if (chatId) {
        set({ telegramChatId: String(chatId) });
        setSuccess(`✅ chat_id دریافت شد: ${chatId}`);
      } else {
        setError("❌ پیامی یافت نشد. به ربات /start بفرستید.");
      }
    } catch (e) {
      setError("❌ خطا: " + String(e));
    }
    setLoading(false);
  };

  const refreshUsers = async () => {
    if (!settings.telegramToken?.trim()) { setError("⚠️ توکن ربات خالی است"); return; }
    setLoadingUsers(true);
    setError("");
    try {
      const usersList = await getTelegramUsers(settings.telegramToken);
      setTelegramUsers(usersList);
      localStorage.setItem("db_telegram_users", JSON.stringify(usersList));
      setSuccess(`✅ ${usersList.length} کاربر دریافت شد`);
    } catch (e) {
      setError("❌ خطا: " + String(e));
    }
    setLoadingUsers(false);
  };

  const copyChatId = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setSuccess(`✅ chat_id ${id} کپی شد`);
    setTimeout(() => setSuccess(""), 2000);
  };

  // ═══════════ بکاپ‌گیری ═══════════
  const exportBackup = () => {
    try {
      const data: Record<string, any> = {};
      for (const key of BACKUP_KEYS) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) data[key] = JSON.parse(raw);
        } catch {}
      }
      const backup = {
        _version: "1.0",
        _createdAt: new Date().toISOString(),
        _siteName: settings.siteName || "صرافی",
        _keys: Object.keys(data),
        data,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      const fname = `backup-${settings.siteName || "exchange"}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}.json`;
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(`✅ فایل بکاپ (${Object.keys(data).length} آیتم) دانلود شد`);
      setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError("❌ خطا در ایجاد بکاپ: " + String(e));
    }
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      setError("❌ فقط فایل JSON معتبر است");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const backup = JSON.parse(ev.target?.result as string);
        if (!backup.data || typeof backup.data !== "object") {
          setError("❌ ساختار فایل بکاپ نامعتبر است");
          return;
        }
        const msg = `⚠️ هشدار مهم:\n\nاین عملیات تمام اطلاعات فعلی را با فایل بکاپ جایگزین می‌کند.\n\nفایل: ${file.name}\nایجاد شده: ${backup._createdAt ? new Date(backup._createdAt).toLocaleString("fa-IR") : "نامشخص"}\nآیتم‌ها: ${Object.keys(backup.data).length}\n\nآیا مطمئن هستید؟`;
        if (!window.confirm(msg)) {
          if (importRef.current) importRef.current.value = "";
          return;
        }
        let count = 0;
        for (const key of Object.keys(backup.data)) {
          try {
            localStorage.setItem(key, JSON.stringify(backup.data[key]));
            count++;
          } catch {}
        }
        setSuccess(`✅ بکاپ بازیابی شد (${count} آیتم). صفحه رفرش می‌شود...`);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err) {
        setError("❌ خطا در خواندن فایل: " + String(err));
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = "";
  };

  const clearAllData = () => {
    const msg = `⛔️ هشدار خطرناک!\n\nتمام اطلاعات صرافی حذف می‌شود:\n- مشتریان\n- معاملات\n- حواله‌ها\n- صندوق\n- تنظیمات\n\nاین عملیات قابل بازگشت نیست!\n\nاگر مطمئن هستید، عبارت "پاک شود" را بنویسید:`;
    const answer = window.prompt(msg);
    if (answer !== "پاک شود") return;
    for (const key of BACKUP_KEYS) {
      try { localStorage.removeItem(key); } catch {}
    }
    setSuccess("✅ تمام اطلاعات پاک شد. صفحه رفرش می‌شود...");
    setTimeout(() => window.location.reload(), 1500);
  };

  // ═══════════ استایل ═══════════
  const heading = dk ? "text-white" : "text-slate-900";
  const subText = dk ? "text-slate-400" : "text-slate-500";
  const card = dk ? "border-slate-700 bg-slate-800/90" : "border-slate-200 bg-white/95";
  const input = dk ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-800";
  const sectionBg = dk ? "bg-slate-900/50" : "bg-slate-50";

  const Section = ({ id, icon, title, subtitle, gradient, badge, children }: any) => (
    <div className={`rounded-2xl border backdrop-blur overflow-hidden transition-all duration-300 ${card} shadow-sm hover:shadow-md`}>
      <button
        onClick={() => toggle(id)}
        className={`w-full p-5 flex items-center justify-between transition-colors ${dk ? "hover:bg-slate-700/30" : "hover:bg-slate-50"}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 grid place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-white text-2xl shadow-lg`}>
            {icon}
          </div>
          <div className="text-right">
            <h2 className={`text-lg font-black ${heading}`}>{title}</h2>
            <p className={`text-xs ${subText}`}>{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <div className={`grid w-8 h-8 place-items-center rounded-lg ${dk ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"}`}>
            <svg className={`w-4 h-4 transition-transform duration-300 ${openSections[id] ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      <div className={`transition-all duration-300 overflow-hidden ${openSections[id] ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className={`p-5 pt-4 space-y-4 border-t ${dk ? "border-slate-700" : "border-slate-100"}`}>
          {children}
        </div>
      </div>
    </div>
  );

  const FieldBox = ({ label, icon, children }: any) => (
    <div>
      <label className={`block text-xs font-black mb-1.5 ${subText}`}>
        <span className="ml-1">{icon}</span>{label}
      </label>
      {children}
    </div>
  );

  const Input = (props: any) => (
    <input
      {...props}
      className={`w-full h-12 px-3.5 rounded-xl border text-sm font-medium outline-none transition-all duration-200 focus:ring-4 ${input} ${dk ? "focus:border-emerald-400 focus:ring-emerald-400/10" : "focus:border-emerald-500 focus:ring-emerald-500/10"} ${props.className || ""}`}
    />
  );

  const totalItems = Object.values(backupStats).reduce((s, n) => s + (n || 0), 0);

  return (
    <div dir="rtl" className={dk ? "dark" : ""}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.st-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.st-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif}.dark{color-scheme:dark}@keyframes stSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}.st-spin{animation:stSpin 8s linear infinite}@keyframes stUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.st-up{animation:stUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(16,185,129,.25)}`}</style>

      <div className={`st-font relative min-h-screen transition-colors duration-500 ${dk ? "bg-[#0f172a] text-slate-100" : "bg-gradient-to-br from-slate-50 via-white to-emerald-50 text-slate-800"}`}>
        <div className={`fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l ${dk ? "from-emerald-400 via-teal-400 to-cyan-400" : "from-emerald-500 via-teal-500 to-cyan-500"}`} />
        <div className="relative z-10 mx-auto w-full max-w-4xl px-3 md:px-6 pb-16 pt-5 md:pt-9">

          {/* Header */}
          <header className="st-up mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-white/30 ${openSections.general ? "" : ""}`}>
                <svg className="w-7 h-7 st-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={`absolute -bottom-1 -left-1 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 px-1 text-[8px] font-black text-white ring-2 ${dk ? "ring-[#0f172a]" : "ring-white"}`}>ST</span>
              </div>
              <div>
                <h1 className={`st-display text-2xl md:text-4xl leading-none ${heading}`}>تنظیمات سیستم</h1>
                <p className={`mt-1 text-[11px] md:text-xs font-bold ${subText}`}>مدیریت صرافی، ربات و پشتیبان‌گیری</p>
              </div>
            </div>
            <button
              onClick={() => setTheme(dk ? "light" : "dark")}
              className={`grid h-11 w-11 place-items-center rounded-xl border transition-all active:scale-90 ${dk ? "border-slate-600 bg-slate-800 text-amber-300" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {dk ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
          </header>

          {/* آمار سریع */}
          <div className="st-up grid grid-cols-2 md:grid-cols-4 gap-2 mb-6" style={{ animationDelay: "60ms" }}>
            {[
              { l: "ربات تلگرام", v: botInfo ? "فعال" : "غیرفعال", c: botInfo ? "text-emerald-500" : "text-slate-400", i: "🤖" },
              { l: "کاربران ربات", v: telegramUsers.length, c: dk ? "text-sky-300" : "text-sky-600", i: "👥" },
              { l: "آیتم‌های داده", v: totalItems, c: dk ? "text-amber-300" : "text-amber-600", i: "💾" },
              { l: "حالت", v: dk ? "تیره" : "روشن", c: dk ? "text-violet-300" : "text-violet-600", i: "🎨" },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border p-3 ${card}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{s.i}</span>
                  <div className="flex-1">
                    <div className={`text-[10px] font-bold ${subText}`}>{s.l}</div>
                    <div className={`text-sm font-black tabular-nums ${s.c}`}>{s.v}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">

            {/* ═══════════ اطلاعات عمومی ═══════════ */}
            <div className="st-up" style={{ animationDelay: "100ms" }}>
              <Section
                id="general"
                icon="🏢"
                title="اطلاعات عمومی"
                subtitle="نام و مشخصات صرافی"
                gradient="from-amber-400 to-orange-500"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldBox label="نام صرافی" icon="🏷️">
                    <Input value={settings.siteName || ""} onChange={e => set({ siteName: e.target.value })} placeholder="صرافی برادران نورزاد" />
                  </FieldBox>
                  <FieldBox label="شماره تماس" icon="📱">
                    <Input value={settings.phone || ""} onChange={e => set({ phone: e.target.value })} placeholder="+93 700 000 000" dir="ltr" />
                  </FieldBox>
                </div>
                <FieldBox label="آدرس" icon="📍">
                  <Input value={settings.address || ""} onChange={e => set({ address: e.target.value })} placeholder="هرات، افغانستان" />
                </FieldBox>
              </Section>
            </div>

            {/* ═══════════ ربات تلگرام ═══════════ */}
            <div className="st-up" style={{ animationDelay: "140ms" }}>
              <Section
                id="telegram"
                icon="🤖"
                title="ربات تلگرام"
                subtitle={botInfo ? `@${botInfo.username}` : "تنظیمات ربات و کاربران"}
                gradient="from-sky-400 to-blue-600"
                badge={
                  botInfo ? (
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black ring-1 ring-emerald-300">✓ فعال</span>
                  ) : (
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-black ring-1 ${dk ? "bg-slate-700 text-slate-400 ring-slate-600" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>○ غیرفعال</span>
                  )
                }
              >
                <FieldBox label="توکن ربات تلگرام" icon="🔐">
                  <Input
                    value={settings.telegramToken || ""}
                    onChange={e => set({ telegramToken: e.target.value })}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    dir="ltr"
                    className="font-mono text-xs"
                  />
                  <p className={`text-[11px] mt-1.5 ${subText}`}>💡 از @BotFather در تلگرام دریافت کنید</p>
                </FieldBox>

                {/* لیست کاربران */}
                <div className={`rounded-xl p-4 space-y-3 ${sectionBg}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className={`text-sm font-black flex items-center gap-2 ${heading}`}>
                      👥 کاربران ربات
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${dk ? "bg-sky-400/15 text-sky-300" : "bg-sky-100 text-sky-700"}`}>
                        {telegramUsers.length}
                      </span>
                    </h3>
                    <button
                      onClick={refreshUsers}
                      disabled={loadingUsers}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black text-white transition-all active:scale-95 disabled:opacity-50 ${dk ? "bg-sky-500 hover:bg-sky-400" : "bg-sky-500 hover:bg-sky-600"}`}
                    >
                      {loadingUsers ? "⏳ ..." : "🔄 به‌روزرسانی"}
                    </button>
                  </div>

                  {telegramUsers.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {telegramUsers.map(user => (
                        <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${dk ? "bg-slate-800/60 border-slate-700 hover:border-sky-500" : "bg-white border-slate-200 hover:border-sky-400"}`}>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-black truncate ${heading}`}>
                              {user.firstName} {user.lastName || ""}
                            </div>
                            <div className={`text-[11px] mt-0.5 ${subText}`}>
                              {user.username ? <span dir="ltr">@{user.username} · </span> : ""}
                              <span className="font-mono font-black" dir="ltr">id: {user.id}</span>
                            </div>
                            {user.lastSeen && (
                              <div className={`text-[10px] mt-0.5 ${subText}`}>آخرین: {user.lastSeen}</div>
                            )}
                          </div>
                          <button
                            onClick={() => copyChatId(user.id)}
                            className={`text-[11px] px-3 py-1.5 rounded-lg font-black transition-all active:scale-95 ${dk ? "bg-slate-700 text-slate-200 hover:bg-slate-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                          >
                            📋 کپی
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-xs text-center py-6 ${subText}`}>
                      هنوز کاربری به ربات پیام نداده. روی «🔄 به‌روزرسانی» بزنید.
                    </p>
                  )}
                </div>

                {/* اعلان با صدا */}
                <div className={`rounded-xl p-4 ${sectionBg}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.telegramSilent !== true}
                      onChange={e => set({ telegramSilent: !e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-400 mt-0.5"
                    />
                    <div>
                      <p className={`text-sm font-black ${heading}`}>🔊 ارسال پیام با صدا</p>
                      <p className={`text-xs mt-0.5 ${subText}`}>مشتری‌ها صدای نوتیفیکیشن را بشنوند</p>
                    </div>
                  </label>
                </div>

                {/* chat_id */}
                <FieldBox label="chat_id اصلی (برای تست)" icon="💬">
                  <div className="flex gap-2">
                    <Input
                      value={settings.telegramChatId || ""}
                      onChange={e => set({ telegramChatId: e.target.value })}
                      placeholder="123456789"
                      dir="ltr"
                      className="font-mono flex-1"
                    />
                    <button
                      onClick={fetchChatId}
                      disabled={loading}
                      className={`px-4 py-2 rounded-xl text-xs font-black text-white whitespace-nowrap transition-all active:scale-95 disabled:opacity-50 ${dk ? "bg-sky-500 hover:bg-sky-400" : "bg-sky-500 hover:bg-sky-600"}`}
                    >
                      {loading ? "⏳" : "📥 دریافت"}
                    </button>
                  </div>
                  <p className={`text-[11px] mt-1.5 ${subText}`}>💡 ابتدا به ربات /start بفرستید</p>
                </FieldBox>

                <button
                  onClick={testTelegram}
                  disabled={loading}
                  className={`w-full rounded-xl py-3 text-sm font-black text-white transition-all active:scale-[0.98] disabled:opacity-50 ${dk ? "bg-gradient-to-l from-sky-400 to-blue-500" : "bg-gradient-to-l from-sky-500 to-blue-600"} hover:brightness-110 shadow-lg`}
                >
                  {loading ? "⏳ در حال ارسال..." : "🧪 تست ارسال پیام"}
                </button>

                {testResult && (
                  <div className={`text-sm rounded-xl p-3 text-center font-black ${
                    testResult.startsWith("✅")
                      ? (dk ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200")
                      : (dk ? "bg-rose-400/15 text-rose-300 border border-rose-400/30" : "bg-rose-50 text-rose-700 border border-rose-200")
                  }`}>
                    {testResult}
                  </div>
                )}
              </Section>
            </div>

            {/* ═══════════ بکاپ‌گیری ═══════════ */}
            <div className="st-up" style={{ animationDelay: "180ms" }}>
              <Section
                id="backup"
                icon="💾"
                title="پشتیبان‌گیری"
                subtitle="Export / Import / پاک‌سازی داده‌ها"
                gradient="from-emerald-400 to-teal-500"
                badge={
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-black ${dk ? "bg-emerald-400/15 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                    {totalItems} آیتم
                  </span>
                }
              >
                <div className={`rounded-xl p-4 ${sectionBg}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">📊</span>
                    <b className={`text-xs font-black ${heading}`}>آمار داده‌ها</b>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px]">
                    {[
                      { k: "fx-customers", l: "مشتریان", i: "👥" },
                      { k: "fx-transactions", l: "معاملات", i: "💱" },
                      { k: "hawalas", l: "حواله‌ها", i: "📨" },
                      { k: "cash-entries", l: "صندوق", i: "🏦" },
                      { k: "db_telegram_users", l: "کاربران ربات", i: "🤖" },
                      { k: "tracking-code-counter", l: "کد پیگیری", i: "🏷️" },
                    ].map(item => (
                      <div key={item.k} className={`flex items-center justify-between p-2 rounded-lg ${dk ? "bg-slate-800" : "bg-white"}`}>
                        <span className={subText}><span className="ml-1">{item.i}</span>{item.l}</span>
                        <b className={`font-black tabular-nums ${dk ? "text-emerald-300" : "text-emerald-600"}`}>{backupStats[item.k] || 0}</b>
                      </div>
                    ))}
                  </div>
                </div>

                {/* دکمه‌های اصلی */}
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    onClick={exportBackup}
                    className={`rounded-xl p-4 text-right transition-all active:scale-[0.98] hover:shadow-lg ${dk ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 hover:border-emerald-400" : "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-400"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-xl text-white shadow-md bg-gradient-to-br from-emerald-500 to-teal-500`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </div>
                      <div className="flex-1">
                        <b className={`text-sm font-black ${dk ? "text-emerald-300" : "text-emerald-700"}`}>دانلود بکاپ</b>
                        <p className={`text-[11px] mt-0.5 ${subText}`}>تمام اطلاعات را در یک فایل JSON دانلود کنید</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => importRef.current?.click()}
                    className={`rounded-xl p-4 text-right transition-all active:scale-[0.98] hover:shadow-lg ${dk ? "bg-gradient-to-br from-sky-500/20 to-blue-500/10 border border-sky-400/30 hover:border-sky-400" : "bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 hover:border-sky-400"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-xl text-white shadow-md bg-gradient-to-br from-sky-500 to-blue-600`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      </div>
                      <div className="flex-1">
                        <b className={`text-sm font-black ${dk ? "text-sky-300" : "text-sky-700"}`}>بازیابی بکاپ</b>
                        <p className={`text-[11px] mt-0.5 ${subText}`}>فایل بکاپ قبلی را بارگذاری کنید</p>
                      </div>
                    </div>
                  </button>

                  <input
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={importBackup}
                    className="hidden"
                  />
                </div>

                {/* هشدار و پاک‌سازی */}
                <div className={`rounded-xl border p-4 ${dk ? "border-rose-400/30 bg-rose-400/10" : "border-rose-200 bg-rose-50"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${dk ? "bg-rose-400/20 text-rose-300" : "bg-rose-100 text-rose-600"}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div className="flex-1">
                      <b className={`text-sm font-black ${dk ? "text-rose-300" : "text-rose-700"}`}>پاک‌سازی کامل</b>
                      <p className={`text-[11px] mt-0.5 ${dk ? "text-rose-300/70" : "text-rose-600/80"}`}>
                        ⚠️ قبل از پاک‌سازی، حتماً بکاپ بگیرید. این عملیات قابل بازگشت نیست.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={clearAllData}
                    className={`w-full rounded-xl py-2.5 text-xs font-black text-white transition-all active:scale-[0.98] ${dk ? "bg-rose-500 hover:bg-rose-400" : "bg-rose-500 hover:bg-rose-600"} shadow-md`}
                  >
                    🗑️ پاک کردن تمام داده‌ها
                  </button>
                </div>

                <div className={`rounded-xl p-3 text-center text-[11px] ${subText}`}>
                  💡 <b>نکته:</b> برای انتقال داده‌ها به دستگاه دیگر، ابتدا بکاپ دانلود کنید، سپس در دستگاه جدید بازیابی نمایید.
                </div>
              </Section>
            </div>

            {/* ═══════════ امنیت ═══════════ */}
            <div className="st-up" style={{ animationDelay: "220ms" }}>
              <Section
                id="security"
                icon="🔐"
                title="امنیت ورود"
                subtitle="نام کاربری و رمز عبور"
                gradient="from-purple-400 to-pink-500"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldBox label="نام کاربری" icon="👤">
                    <Input value={settings.username || "admin"} onChange={e => set({ username: e.target.value })} />
                  </FieldBox>
                  <FieldBox label="رمز عبور" icon="🔑">
                    <Input type="password" value={settings.password || "admin123"} onChange={e => set({ password: e.target.value })} />
                  </FieldBox>
                </div>
              </Section>
            </div>

            {/* ═══════════ درباره ═══════════ */}
            <div className="st-up" style={{ animationDelay: "260ms" }}>
              <Section
                id="about"
                icon="ℹ️"
                title="درباره سیستم"
                subtitle="نسخه و اطلاعات فنی"
                gradient="from-slate-400 to-slate-600"
              >
                <div className={`grid gap-2 text-xs ${dk ? "text-slate-300" : "text-slate-600"}`}>
                  <div className={`flex justify-between p-2.5 rounded-lg ${sectionBg}`}>
                    <span className={subText}>نام سیستم:</span>
                    <b className="font-black">{settings.siteName || "صرافی"}</b>
                  </div>
                  <div className={`flex justify-between p-2.5 rounded-lg ${sectionBg}`}>
                    <span className={subText}>نسخه:</span>
                    <b className="font-black tabular-nums" dir="ltr">v1.0.0</b>
                  </div>
                  <div className={`flex justify-between p-2.5 rounded-lg ${sectionBg}`}>
                    <span className={subText}>ذخیره‌سازی:</span>
                    <b className="font-black">localStorage</b>
                  </div>
                  <div className={`flex justify-between p-2.5 rounded-lg ${sectionBg}`}>
                    <span className={subText}>زبان:</span>
                    <b className="font-black">فارسی (دری)</b>
                  </div>
                </div>
              </Section>
            </div>
          </div>

          {/* دکمه ذخیره نهایی */}
          <div className="st-up sticky bottom-4 mt-6" style={{ animationDelay: "300ms" }}>
            <button
              onClick={saveSettings}
              className={`w-full rounded-2xl py-4 text-base font-black text-white shadow-2xl transition-all active:scale-[0.98] hover:brightness-110 flex items-center justify-center gap-2 ${dk ? "bg-gradient-to-l from-emerald-400 via-teal-400 to-cyan-400" : "bg-gradient-to-l from-emerald-500 via-teal-500 to-cyan-500"}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>💾 ذخیره تمام تنظیمات</span>
            </button>
          </div>

          {/* پیام‌ها */}
          {error && (
            <div className={`mt-4 rounded-xl p-3 text-sm font-bold ${dk ? "bg-rose-400/15 text-rose-300 border border-rose-400/30" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {error}
            </div>
          )}
          {success && (
            <div className={`mt-4 rounded-xl p-3 text-sm font-bold ${dk ? "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
              {success}
            </div>
          )}

          <div className="mt-8 text-center">
            <p className={`text-[10px] ${subText}`}>
              💚 ساخته شده با ❤️ برای صرافی برادران نورزاد
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
