"use client";

import { useState, useEffect } from "react";
import { useStored, Field, ErrorBox } from "../lib/ui";
import { loadJSON, fa } from "../lib/helpers";
import { sendTelegram, getLastChatId, getUpdates } from "../lib/telegram";

// 🆕 Interface برای کاربران تلگرام
interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  lastSeen: string;
}

export default function SettingsPage() {
  // 🆕 بارگذاری تنظیمات
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

  // 🆕 stateها
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState("");
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);

  // 🆕 بارگذاری لیست کاربران تلگرام از localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("db_telegram_users");
      if (stored) {
        setTelegramUsers(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Load telegram users error:", e);
    }
  }, []);

  const set = (patch: any) => {
    setSettings({ ...settings, ...patch });
    setError("");
    setSuccess("");
  };

  // 🆕 ذخیره تنظیمات
  const saveSettings = () => {
    try {
      setSettings(settings);
      setSuccess("✅ تنظیمات با موفقیت ذخیره شد");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError("❌ خطا در ذخیره تنظیمات");
    }
  };

  // 🆕 تست ارسال پیام به تلگرام
  const testTelegram = async () => {
    if (!settings.telegramToken?.trim()) {
      setError("⚠️ لطفاً ابتدا توکن ربات را وارد کنید");
      return;
    }
    if (!settings.telegramChatId?.trim()) {
      setError("⚠️ لطفاً chat_id را دریافت کنید");
      return;
    }

    setLoading(true);
    setTestResult("");
    try {
      const message = `🎉 تست اتصال ربات تلگرام\n\nصرافی: ${settings.siteName || "برادران نورزاد"}\nتاریخ: ${new Date().toLocaleDateString("fa-IR")}\nساعت: ${new Date().toLocaleTimeString("fa-IR")}\n\n✅ اگر این پیام را دریافت کردید، ربات شما به درستی کار می‌کند!`;
      const ok = await sendTelegram(
        settings.telegramToken,
        settings.telegramChatId,
        message,
        { silent: settings.telegramSilent === true }
      );
      setTestResult(ok ? "✅ پیام تست ارسال شد" : "❌ ارسال ناموفق بود");
    } catch (e) {
      setTestResult("❌ خطا: " + String(e));
    }
    setLoading(false);
  };

  // 🆕 دریافت chat_id از getUpdates
  const fetchChatId = async () => {
    if (!settings.telegramToken?.trim()) {
      setError("⚠️ لطفاً ابتدا توکن ربات را وارد کنید");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const chatId = await getLastChatId(settings.telegramToken);
      if (chatId) {
        set({ telegramChatId: String(chatId) });
        setSuccess(`✅ chat_id دریافت شد: ${chatId}`);
      } else {
        setError("❌ هیچ پیامی از کاربران یافت نشد. لطفاً به ربات /start بفرستید.");
      }
    } catch (e) {
      setError("❌ خطا در دریافت chat_id: " + String(e));
    }
    setLoading(false);
  };

  // 🆕 به‌روزرسانی لیست کاربران ربات
  const refreshUsers = async () => {
    if (!settings.telegramToken?.trim()) {
      setError("⚠️ لطفاً ابتدا توکن ربات را وارد کنید");
      return;
    }

    setLoadingUsers(true);
    setError("");
    try {
      const updates = await getUpdates(settings.telegramToken);
      const usersMap = new Map<number, TelegramUser>();

      // استخراج کاربران unique از updates
      updates.forEach((update: any) => {
        if (update.message?.from) {
          const user = update.message.from;
          usersMap.set(user.id, {
            id: user.id,
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            username: user.username || "",
            lastSeen: update.message.date
              ? new Date(update.message.date * 1000).toLocaleString("fa-IR")
              : "",
          });
        }
      });

      const usersList = Array.from(usersMap.values()).sort((a, b) => b.id - a.id);
      setTelegramUsers(usersList);

      // ذخیره در localStorage برای استفاده در تب مشتری‌ها
      localStorage.setItem("db_telegram_users", JSON.stringify(usersList));

      setSuccess(`✅ ${usersList.length} کاربر از ربات دریافت شد`);
      setShowUsers(true);
    } catch (e) {
      setError("❌ خطا در دریافت لیست کاربران: " + String(e));
    }
    setLoadingUsers(false);
  };

  // 🆕 کپی chat_id
  const copyChatId = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setSuccess(`✅ chat_id ${id} کپی شد`);
    setTimeout(() => setSuccess(""), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold flex items-center gap-2">
        🛠️ تنظیمات سیستم
      </h1>

      {/* ✅ بخش تنظیمات عمومی */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center text-xl">
            🏢
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0b1f2e]">اطلاعات صرافی</h2>
            <p className="text-xs text-slate-500">نام و مشخصات کسب‌وکار</p>
          </div>
        </div>
        <Field
          label="🏷️ نام صرافی"
          value={settings.siteName || ""}
          onChange={v => set({ siteName: v })}
          placeholder="صرافی برادران نورزاد"
        />
        <Field
          label="📍 آدرس"
          value={settings.address || ""}
          onChange={v => set({ address: v })}
          placeholder="هرات، افغانستان"
        />
        <Field
          label="📱 شماره تماس"
          value={settings.phone || ""}
          onChange={v => set({ phone: v })}
          placeholder="+93 700 000 000"
        />
      </div>

      {/* 🤖 بخش تنظیمات ربات تلگرام */}
      <div className="card p-5 space-y-5 border-2 border-sky-200">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
          <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-blue-600 rounded-xl flex items-center justify-center text-2xl">
            🤖
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#0b1f2e]">تنظیمات ربات تلگرام</h2>
            <p className="text-xs text-slate-500">مدیریت ربات و کاربران متصل</p>
          </div>
        </div>

        {/* 🔐 توکن ربات */}
        <div>
          <label className="block text-sm font-bold mb-2">
            🔐 توکن ربات تلگرام
          </label>
          <input
            className="input font-mono text-sm"
            dir="ltr"
            value={settings.telegramToken || ""}
            onChange={e => set({ telegramToken: e.target.value })}
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            💡 از @BotFather در تلگرام دریافت کنید
          </p>
        </div>

        {/* 📊 لیست کاربران ربات */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              📊 لیست کاربران ربات
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-mono">
                {telegramUsers.length} کاربر
              </span>
            </h3>
            <button
              onClick={refreshUsers}
              disabled={loadingUsers}
              className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              {loadingUsers ? "⏳" : "🔄"} به‌روزرسانی
            </button>
          </div>

          {showUsers && telegramUsers.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {telegramUsers.map(user => (
                <div
                  key={user.id}
                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 hover:border-sky-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#0b1f2e]">
                      {user.firstName} {user.lastName || ""}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {user.username ? `@${user.username} • ` : ""}
                      chat_id: <span className="font-mono font-bold">{user.id}</span>
                    </div>
                    {user.lastSeen && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        آخرین فعالیت: {user.lastSeen}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => copyChatId(user.id)}
                    className="text-xs px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold whitespace-nowrap"
                  >
                    📋 کپی
                  </button>
                </div>
              ))}
            </div>
          )}

          {telegramUsers.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              هنوز کاربری به ربات شما پیام نداده است. روی «🔄 به‌روزرسانی» کلیک کنید.
            </p>
          )}
        </div>

        {/* 🔔 تنظیمات صدا */}
        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            🔔 تنظیمات اعلان
          </h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.telegramSilent !== true}
              onChange={e => set({ telegramSilent: !e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
            />
            <div>
              <p className="font-bold text-sm text-[#0b1f2e]">
                🔊 ارسال پیام با صدا
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                وقتی فعال باشد، مشتری‌ها صدای نوتیفیکیشن را می‌شنوند
              </p>
            </div>
          </label>
        </div>

        {/* 📝 chat_id اصلی */}
        <div>
          <label className="block text-sm font-bold mb-2">
            💬 chat_id اصلی (برای تست)
          </label>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-sm"
              dir="ltr"
              value={settings.telegramChatId || ""}
              onChange={e => set({ telegramChatId: e.target.value })}
              placeholder="123456789"
            />
            <button
              onClick={fetchChatId}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? "⏳" : "📥"} دریافت خودکار
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            💡 ابتدا به ربات /start بفرستید، سپس این دکمه را بزنید
          </p>
        </div>

        {/* 🧪 دکمه تست */}
        <button
          onClick={testTelegram}
          disabled={loading}
          className="w-full rounded-xl bg-sky-500 text-white py-2.5 text-sm font-bold hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? "⏳ در حال ارسال..." : "🧪 تست ارسال پیام"}
        </button>

        {testResult && (
          <div className={`text-sm rounded-lg p-3 text-center font-bold ${
            testResult.startsWith("✅")
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {testResult}
          </div>
        )}
      </div>

      {/* 🔐 بخش تغییر رمز عبور */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center text-xl">
            🔐
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0b1f2e]">امنیت ورود</h2>
            <p className="text-xs text-slate-500">نام کاربری و رمز عبور</p>
          </div>
        </div>
        <Field
          label="👤 نام کاربری"
          value={settings.username || "admin"}
          onChange={v => set({ username: v })}
        />
        <Field
          label="🔑 رمز عبور"
          value={settings.password || "admin123"}
          onChange={v => set({ password: v })}
        />
      </div>

      {/* 💾 دکمه ذخیره نهایی */}
      <div className="card p-4">
        <button
          onClick={saveSettings}
          className="btn-gold w-full flex items-center justify-center gap-2 py-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
          <span className="font-bold">💾 ذخیره همه تنظیمات</span>
        </button>
      </div>

      {/* پیام‌های خطا و موفقیت */}
      <ErrorBox error={error} />
      {success && (
        <div className="text-sm rounded-xl p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
          {success}
        </div>
      )}
    </div>
  );
}
