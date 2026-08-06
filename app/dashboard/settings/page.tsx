"use client";

import { useEffect, useRef, useState } from "react";
import { sendTelegram, getLastChatId, getTelegramUsers, type TelegramUser } from "../lib/telegram";

interface Settings {
  siteName: string;
  whatsappPhone: string;
  telegramToken: string;
  telegramChat: string;
  commission: string;
  username: string;
  password: string;
}

const defaults: Settings = {
  siteName: "صرافی برادران نورزاد",
  whatsappPhone: "989121234567",
  telegramToken: "",
  telegramChat: "",
  commission: "0.5",
  username: "admin",
  password: "admin123",
};

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(defaults);
  const [saved, setSaved] = useState(false);
  const [tgMsg, setTgMsg] = useState("");
  const [tgLoading, setTgLoading] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  // 🆕 State برای لیست کاربران ربات
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersMsg, setUsersMsg] = useState("");

  // بارگذاری لیست کاربران از localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("db_telegram_users");
      if (raw) {
        setTelegramUsers(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Load telegram users error:", e);
    }
  }, []);

  // فقط یک بار در mount از localStorage بخوان
  useEffect(() => {
    try {
      const raw = localStorage.getItem("db_settings");
      if (raw) {
        const parsed = JSON.parse(raw);
        setS(prev => ({ ...defaults, ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Settings load error:", e);
    }
    setLoaded(true);
    return () => { mountedRef.current = false; };
  }, []);

  const update = (patch: Partial<Settings>) => {
    setS(prev => ({ ...prev, ...patch }));
    setMissing([]);
    setError("");
    setTgMsg("");
  };

  const fc = (name: string) => `input ${missing.includes(name) ? "!border-red-500" : ""}`;

  const save = () => {
    const m: string[] = [];
    if (!s.siteName.trim()) m.push("نام صرافی");
    if (!s.username.trim()) m.push("نام کاربری");
    if (!s.password.trim()) m.push("رمز عبور");
    if (m.length) {
      setMissing(m);
      setError("لطفاً این فیلدها را پر کنید: " + m.join("، "));
      return;
    }

    try {
      localStorage.setItem("db_settings", JSON.stringify(s));
      setMissing([]);
      setError("");
      setSaved(true);
      setTimeout(() => { if (mountedRef.current) setSaved(false); }, 2500);
    } catch (e) {
      setError("خطا در ذخیره: " + String(e));
    }
  };

  const testTg = async () => {
    if (!s.telegramToken.trim()) { setTgMsg("❌ اول توکن ربات را وارد و ذخیره کنید"); return; }
    if (!s.telegramChat.trim()) { setTgMsg("❌ اول chat_id را وارد یا دریافت کنید"); return; }

    setTgLoading(true);
    setTgMsg("⏳ در حال ارسال...");
    const text = `✅ <b>تست موفق</b>\n\nربات تلگرام صرافی <b>${s.siteName}</b> با موفقیت وصل شد.\n\nاز این پس رسید معاملات به صورت خودکار برای مشتریان ارسال می‌شود.`;
    const ok = await sendTelegram(s.telegramToken.trim(), s.telegramChat.trim(), text);
    setTgMsg(ok ? "✅ پیام تست به ربات ارسال شد" : "❌ ارسال نشد؛ توکن یا chat_id را بررسی کنید");
    setTgLoading(false);
  };

  const getChat = async () => {
    if (!s.telegramToken.trim()) { setTgMsg("❌ اول توکن ربات را وارد کنید"); return; }
    setTgLoading(true);
    setTgMsg("⏳ در حال دریافت chat_id...");
    const id = await getLastChatId(s.telegramToken.trim());
    if (id) {
      update({ telegramChat: id });
      setTgMsg(`✅ chat_id دریافت شد: ${id} — حالا «ذخیره تنظیمات» را بزنید`);
    } else {
      setTgMsg("❌ chat_id پیدا نشد. اول در تلگرام به ربات /start بفرستید، سپس دوباره امتحان کنید");
    }
    setTgLoading(false);
  };

  // 🆕 تابع به‌روزرسانی لیست کاربران ربات
  const refreshUsers = async () => {
    if (!s.telegramToken.trim()) { 
      setUsersMsg("❌ اول توکن ربات را وارد و ذخیره کنید"); 
      return; 
    }
    
    setUsersLoading(true);
    setUsersMsg("⏳ در حال دریافت لیست کاربران...");
    
    const users = await getTelegramUsers(s.telegramToken.trim());
    
    if (users.length > 0) {
      setTelegramUsers(users);
      try {
        localStorage.setItem("db_telegram_users", JSON.stringify(users));
        setUsersMsg(`✅ ${users.length} کاربر از ربات دریافت شد`);
      } catch (e) {
        setUsersMsg("⚠️ کاربران دریافت شدند ولی ذخیره نشدند");
      }
    } else {
      setUsersMsg("❌ کاربری پیدا نشد. مطمئن شوید کاربران به ربات /start فرستاده‌اند");
    }
    
    setUsersLoading(false);
  };

  // 🆕 کپی chat_id
  const copyChatId = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setUsersMsg(`✅ chat_id ${id} کپی شد`);
    setTimeout(() => setUsersMsg(""), 2000);
  };

  if (!loaded) {
    return <div className="p-8 text-center">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">تنظیمات</h1>
      <div className="card p-6 max-w-2xl space-y-4">

        <div>
          <label className="block text-sm font-bold mb-2">نام صرافی</label>
          <input className={fc("نام صرافی")} value={s.siteName} onChange={e => update({ siteName: e.target.value })} />
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">شماره واتساپ (با کد کشور)</label>
          <input className="input" dir="ltr" value={s.whatsappPhone} onChange={e => update({ whatsappPhone: e.target.value })} placeholder="989123456789" />
        </div>

        {/* بخش تلگرام */}
        <div className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50 p-5 space-y-3">
          <p className="font-extrabold text-sky-800 text-base">📨 تنظیمات ربات تلگرام</p>
          <p className="text-xs text-slate-600">با اتصال ربات، رسید معاملات خودکار برای مشتری ارسال می‌شود</p>

          <div>
            <label className="block text-sm font-bold mb-2">توکن ربات (از BotFather)</label>
            <input
              className="input font-mono text-xs"
              dir="ltr"
              placeholder="123456789:AAH..."
              value={s.telegramToken}
              onChange={e => update({ telegramToken: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">chat_id پیش‌فرض (برای تست)</label>
            <input
              className="input font-mono text-xs"
              dir="ltr"
              placeholder="123456789"
              value={s.telegramChat}
              onChange={e => update({ telegramChat: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 disabled:opacity-50"
              onClick={getChat}
              disabled={tgLoading}
            >
              {tgLoading ? "⏳" : "🔍"} دریافت آخرین chat_id
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              onClick={testTg}
              disabled={tgLoading}
            >
              {tgLoading ? "⏳" : "📤"} تست ارسال پیام
            </button>
          </div>

          {tgMsg && (
            <div className={`text-sm font-bold rounded-lg p-3 ${tgMsg.startsWith("✅") ? "bg-emerald-100 text-emerald-700" : tgMsg.startsWith("❌") ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
              {tgMsg}
            </div>
          )}

          <div className="bg-white/70 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700 mb-1">📖 راهنما:</p>
            <p>۱. توکن را از BotFather بگیرید و بالا وارد کنید</p>
            <p>۲. در تلگرام به ربات خود <b>/start</b> بفرستید</p>
            <p>۳. دکمه «دریافت chat_id» را بزنید</p>
            <p>۴. <b>ذخیره تنظیمات</b> را بزنید (مهم!)</p>
            <p>۵. دکمه «تست ارسال» را بزنید</p>
          </div>
        </div>

        {/* 🆕 بخش جدید: لیست کاربران ربات */}
        <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-extrabold text-purple-800 text-base">👥 لیست کاربران ربات</p>
              <p className="text-xs text-slate-600">کاربرانی که به ربات شما پیام فرستاده‌اند</p>
            </div>
            <button
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
              onClick={refreshUsers}
              disabled={usersLoading}
            >
              {usersLoading ? "⏳" : "🔄"} به‌روزرسانی لیست
            </button>
          </div>

          {usersMsg && (
            <div className={`text-sm font-bold rounded-lg p-3 ${usersMsg.startsWith("✅") ? "bg-emerald-100 text-emerald-700" : usersMsg.startsWith("❌") ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
              {usersMsg}
            </div>
          )}

          {telegramUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-purple-100 text-purple-900">
                  <tr>
                    <th className="text-center px-3 py-2 font-bold w-12">شماره</th>
                    <th className="text-right px-3 py-2 font-bold">نام تلگرام</th>
                    <th className="text-right px-3 py-2 font-bold">Username</th>
                    <th className="text-right px-3 py-2 font-bold">chat_id</th>
                    <th className="text-center px-3 py-2 font-bold w-20">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {telegramUsers.map((user, index) => (
                    <tr key={user.id} className="hover:bg-purple-50">
                      <td className="px-3 py-2 text-center font-mono font-bold text-purple-900">
                        {(index + 1).toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-2 font-bold text-slate-900">
                        {user.firstName} {user.lastName || ""}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-xs">
                        {user.username ? `@${user.username}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono text-xs" dir="ltr">
                        {user.id}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700"
                          onClick={() => copyChatId(user.id)}
                        >
                          📋 کپی
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              هنوز کاربری ثبت نشده. دکمه «به‌روزرسانی لیست» را بزنید.
            </div>
          )}

          <div className="bg-white/70 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700 mb-1">💡 نکته:</p>
            <p>• برای دیدن کاربران، باید حداقل یک نفر به ربات شما /start فرستاده باشد</p>
            <p>• می‌توانید chat_id را کپی کرده و در بخش مشتریان استفاده کنید</p>
            <p>• در تب مشتریان، می‌توانید مستقیماً از لیست انتخاب کنید</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">کارمزد معاملات (%)</label>
          <input className="input" value={s.commission} onChange={e => update({ commission: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">نام کاربری ورود</label>
            <input className={fc("نام کاربری")} value={s.username} onChange={e => update({ username: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">رمز عبور ورود</label>
            <input className={fc("رمز عبور")} value={s.password} onChange={e => update({ password: e.target.value })} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button className="btn-gold" onClick={save}>ذخیره تنظیمات</button>
          {saved && <span className="text-emerald-600 text-sm font-bold">✓ ذخیره شد</span>}
        </div>

        {/* نمایش وضعیت ذخیره فعلی برای دیباگ */}
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">🔍 نمایش وضعیت فعلی (برای دیباگ)</summary>
          <pre className="mt-2 bg-slate-50 p-3 rounded-lg overflow-auto" dir="ltr">
{JSON.stringify({
  siteName: s.siteName,
  hasTelegramToken: Boolean(s.telegramToken),
  telegramTokenLength: s.telegramToken.length,
  telegramChat: s.telegramChat,
  telegramUsersCount: telegramUsers.length,
}, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
