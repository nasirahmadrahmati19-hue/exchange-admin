"use client";

import { useState } from "react";
import { useSafeSyncedState } from "../lib/useSafeSyncedState";

// ============================================================
// تب حسابات رمزی — کاملاً مستقل
// به هیچ بخش دیگری از برنامه وصل نیست.
// داده‌ها فقط در Firestore کاربر لاگین‌شده ذخیره می‌شوند
// (مسیر: users/{uid}/secret_accounts) و در localStorage نیستند.
// ============================================================

type SecretAccount = {
  id: string | number;
  title: string;      // نام سرویس / سایت
  username: string;   // نام کاربری یا ایمیل
  password: string;   // رمز عبور
  note: string;       // یادداشت اختیاری
  createdAt: string;  // تاریخ ثبت
};

const EMPTY_FORM: Omit<SecretAccount, "id" | "createdAt"> = {
  title: "",
  username: "",
  password: "",
  note: "",
};

export default function SecretAccountsPage() {
  const [accounts, setAccounts, loaded] = useSafeSyncedState<SecretAccount>(
    "secret_accounts",
    []
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const filtered = accounts.filter((a) => {
    const q = search.trim();
    if (!q) return true;
    return (
      a.title?.includes(q) ||
      a.username?.includes(q) ||
      a.note?.includes(q)
    );
  });

  const submit = async () => {
    if (!form.title.trim() || !form.password.trim()) {
      showToast("⚠️ نام سرویس و رمز عبور الزامی است");
      return;
    }
    if (editingId !== null) {
      await setAccounts((prev: SecretAccount[]) =>
        prev.map((a) => (a.id === editingId ? { ...a, ...form } : a))
      );
      setEditingId(null);
      showToast("✅ حساب ویرایش شد");
    } else {
      const newAccount: SecretAccount = {
        id: Date.now(),
        ...form,
        createdAt: new Date().toLocaleString("fa-IR"),
      };
      await setAccounts((prev: SecretAccount[]) => [newAccount, ...prev]);
      showToast("✅ حساب اضافه شد");
    }
    setForm(EMPTY_FORM);
  };

  const edit = (acc: SecretAccount) => {
    setForm({
      title: acc.title || "",
      username: acc.username || "",
      password: acc.password || "",
      note: acc.note || "",
    });
    setEditingId(acc.id);
  };

  const remove = async (id: string | number) => {
    await setAccounts((prev: SecretAccount[]) => prev.filter((a) => a.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    showToast("🗑️ حساب حذف شد");
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`📋 ${label} کپی شد`);
    } catch {
      showToast("❌ کپی ناموفق بود");
    }
  };

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-400/60 transition-colors";

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6 min-h-screen">
      {/* هدر */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            🔐 حسابات رمزی
          </h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1">
            نگهداری امن نام کاربری و رمز عبور — فقط مخصوص شما
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-xs text-emerald-300">
          {accounts.length} حساب
        </span>
      </div>

      {/* فرم افزودن/ویرایش */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur p-4 md:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">
          {editingId !== null ? "✏️ ویرایش حساب" : "➕ افزودن حساب جدید"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className={inputCls}
            placeholder="نام سرویس / سایت *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="نام کاربری / ایمیل"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className={inputCls}
            type="password"
            placeholder="رمز عبور *"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="یادداشت (اختیاری)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={submit}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all px-5 py-2.5 text-sm font-medium text-white"
          >
            {editingId !== null ? "ذخیره تغییرات" : "افزودن"}
          </button>
          {editingId !== null && (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
              className="rounded-xl bg-white/10 hover:bg-white/15 transition-all px-5 py-2.5 text-sm text-white"
            >
              انصراف
            </button>
          )}
        </div>
      </div>

      {/* جستجو */}
      <input
        className={inputCls + " max-w-md"}
        placeholder="🔍 جستجو در حسابات..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* لیست */}
      {!loaded ? (
        <p className="text-sm text-slate-400">در حال بارگذاری…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-slate-400 text-sm">
          هنوز حسابی ثبت نشده است. اولین حساب را از فرم بالا اضافه کنید.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((acc) => {
            const key = String(acc.id);
            const isShown = !!revealed[key];
            return (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-white">{acc.title}</h3>
                  <span className="text-[11px] text-slate-400">{acc.createdAt}</span>
                </div>

                {acc.username && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-300">
                      👤 {acc.username}
                    </span>
                    <button
                      onClick={() => copy(acc.username, "نام کاربری")}
                      className="text-xs rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-white transition-colors"
                    >
                      📋 کپی
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-300 font-mono" dir="ltr">
                    🔑{" "}
                    {isShown
                      ? acc.password
                      : "•".repeat(Math.min(acc.password.length, 14))}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setRevealed({ ...revealed, [key]: !isShown })
                      }
                      className="text-xs rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-white transition-colors"
                    >
                      {isShown ? "🙈 پنهان" : "👁 نمایش"}
                    </button>
                    <button
                      onClick={() => copy(acc.password, "رمز عبور")}
                      className="text-xs rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-white transition-colors"
                    >
                      📋 کپی
                    </button>
                  </div>
                </div>

                {acc.note && (
                  <p className="text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2">
                    📝 {acc.note}
                  </p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => edit(acc)}
                    className="text-xs rounded-lg bg-sky-600/80 hover:bg-sky-600 px-3 py-1.5 text-white transition-colors"
                  >
                    ✏️ ویرایش
                  </button>
                  <button
                    onClick={() => remove(acc.id)}
                    className="text-xs rounded-lg bg-red-600/80 hover:bg-red-600 px-3 py-1.5 text-white transition-colors"
                  >
                    🗑 حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900/95 border border-white/15 px-5 py-3 text-sm text-white shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}
