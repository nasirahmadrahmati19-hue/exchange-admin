"use client";

import { useEffect, useState } from "react";
import { sendTelegram, getLastChatId } from "../lib/telegram";

export default function SettingsPage() {
  const [s, setS] = useState({
    siteName: "صرافی برادران نورزاد",
    whatsappPhone: "989121234567",
    telegramToken: "",
    telegramChat: "",
    commission: "0.5",
    username: "admin",
    password: "admin123",
  });
  const [saved, setSaved] = useState(false);
  const [tgMsg, setTgMsg] = useState("");
  const [tgLoading, setTgLoading] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const v = localStorage.getItem("db_settings");
    if (v) {
      try { setS(prev => ({ ...prev, ...JSON.parse(v) })); } catch {}
    }
  }, []);

  const update = (patch: any) => {
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
    setMissing([]);
    setError("");
    localStorage.setItem("db_settings", JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const testTg = async () => {
    if (!s.telegramToken.trim()) {
      setTgMsg("❌ اول توکن ربات را وارد کنید");
      return;
    }
    if (!s.telegramChat.trim()) {
      setTgMsg("❌ اول chat_id را وارد یا دریافت کنید");
      return;
    }
    setTgLoading(true);
    setTgMsg("⏳ در حال ارسال...");
    const text = `✅ <b>تست موفق</b>\n\nربات تلگرام صرافی <b>${s.siteName}</b> با موفقیت وصل شد.\n\nاز این پس رسید معاملات به صورت خودکار برای مشتریان ارسال می‌شود.`;
    const ok = await sendTelegram(s.telegramToken, s.telegramChat, text);
    setTgMsg(ok ? "✅ پیام تست به ربات ارسال شد" : "❌ ارسال نشد؛ توکن یا chat_id را بررسی کنید");
    setTgLoading(false);
  };

  const getChat = async () => {
    if (!s.telegramToken.trim()) {
      setTgMsg("❌ اول توکن ربات را وارد و ذخیره کنید");
      return;
    }
    setTgLoading(true);
    setTgMsg("⏳ در حال دریافت chat_id...");
    const id = await getLastChatId(s.telegramToken);
    if (id) {
      setS(prev => ({ ...prev, telegramChat: id }));
      setTgMsg(`✅ chat_id دریافت شد: ${id} — حالا ذخیره تنظیمات را بزنید`);
    } else {
      setTgMsg("❌ chat_id پیدا نشد. اول در تلگرام به ربات /start بفرستید، سپس دوباره امتحان کنید");
    }
    setTgLoading(false);
  };

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
              دریافت آخرین chat_id
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
              onClick={testTg}
              disabled={tgLoading}
            >
              تست ارسال پیام
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
            <p>۳. دکمه «دریافت آخرین chat_id» را بزنید</p>
            <p>۴. ذخیره تنظیمات را بزنید</p>
            <p>۵. دکمه «تست ارسال» را بزنید</p>
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
      </div>
    </div>
  );
}
