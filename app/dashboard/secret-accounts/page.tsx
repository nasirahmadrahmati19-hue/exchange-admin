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
  name: string;       // اسم
  wald: string;       // ولد
  phone: string;      // شماره
  address: string;    // آدرس
  createdAt: string;  // تاریخ ثبت
};

// پنج ارز — کارت بالای صفحه
const CRYPTOS = [
  { symbol: "TOM",   name: "تومان",            icon: "🎟️", color: "text-emerald-600" },
  { symbol: "AFN",   name: "افغانی",           icon: "🇦🇫", color: "text-sky-600" },
  { symbol: "EUR",   name: "یورو",             icon: "💶", color: "text-amber-600" },
  { symbol: "USD",   name: "دالر",             icon: "💵", color: "text-green-600" },
  { symbol: "KANDAR",name: "کالدار",           icon: "🧱", color: "text-red-600" },
];

const EMPTY_FORM: Omit<SecretAccount, "id" | "createdAt"> = {
  name: "",
  wald: "",
  phone: "",
  address: "",
};

export default function SecretAccountsPage() {
  const [accounts, setAccounts, loaded] = useSafeSyncedState<SecretAccount>(
    "secret_accounts",
    []
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | number | null>(null);
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
      a.name?.includes(q) ||
      a.wald?.includes(q) ||
      a.phone?.includes(q) ||
      a.address?.includes(q)
    );
  });

  const submit = async () => {
    if (!form.name.trim()) {
      showToast("⚠️ اسم الزامی است");
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
      name: acc.name || "",
      wald: acc.wald || "",
      phone: acc.phone || "",
      address: acc.address || "",
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
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500 transition-colors";

  return (
    <div dir="rtl" className="p-4 md:p-6 space-y-6 min-h-screen bg-white">
      {/* هدر */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            🔐 حسابات رمزی
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            نگهداری امن معلومات شما — فقط مخصوص شما
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs text-emerald-700">
          {accounts.length} حساب
        </span>
      </div>

      {/* کارت پنج ارز */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          💰 پنچ ارز
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {CRYPTOS.map((c) => (
            <div
              key={c.symbol}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-1 text-center hover:bg-slate-100 transition-colors"
            >
              <span className="text-2xl">{c.icon}</span>
              <span className={`text-sm font-bold ${c.color}`} dir="ltr">
                {c.symbol}
              </span>
              <span className="text-[11px] text-slate-500">{c.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* فرم افزودن/ویرایش */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {editingId !== null ? "✏️ ویرایش حساب" : "➕ ساخت حساب"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">اسم *</span>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">ولد</span>
            <input
              className={inputCls}
              value={form.wald}
              onChange={(e) => setForm({ ...form, wald: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">شماره</span>
            <input
              className={inputCls}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">آدرس</span>
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
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
              className="rounded-xl bg-slate-100 hover:bg-slate-200 transition-all px-5 py-2.5 text-sm text-slate-700"
            >
              انصراف
            </button>
          )}
        </div>
      </div>

      {/* لیست */}
      <h2 className="text-sm font-semibold text-slate-900">📒 فهرست حسابات</h2>

      {/* جستجو — بالای فهرست */}
      <input
        className={inputCls + " max-w-md"}
        placeholder="🔍 اسم، ولد، شماره یا آدرس را جستجو کنید..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!loaded ? (
        <p className="text-sm text-slate-400">در حال بارگذاری…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
          هنوز حسابی ثبت نشده است. اولین حساب را از فرم بالا اضافه کنید.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((acc) => {
            const key = String(acc.id);
            return (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-semibold text-slate-900">
                    {acc.name}
                    {acc.wald ? ` — ولد: ${acc.wald}` : ""}
                  </h3>
                  <span className="text-[11px] text-slate-400">{acc.createdAt}</span>
                </div>

                {acc.phone && (
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700" dir="ltr">
                      📞 شماره: {acc.phone}
                    </span>
                    <button
                      onClick={() => copy(acc.phone, "شماره")}
                      className="text-xs rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-slate-700 transition-colors"
                    >
                      📋 کپی
                    </button>
                  </div>
                )}

                {acc.address && (
                  <p className="text-sm text-slate-700">📍 آدرس: {acc.address}</p>
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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 border border-slate-700 px-5 py-3 text-sm text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
