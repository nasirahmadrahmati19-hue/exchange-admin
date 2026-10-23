"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// ============================================================
// تب حسابات رمزی — کاملاً مستقل
// به هیچ بخش دیگری از برنامه وصل نیست.
// داده‌ها فقط در Firestore کاربر لاگین‌شده ذخیره می‌شوند
// (مسیر: users/{uid}/secret_accounts) و در localStorage نیستند.
// تراکنش‌های واریز/برداشت: users/{uid}/secret_transactions
// ============================================================

type SecretAccount = {
  id: string | number;
  name: string;       // اسم
  wald: string;       // ولد
  phone: string;      // شماره
  address: string;    // آدرس
  currency: string;   // ارز (TOM / AFN / EUR / USD / KANDAR)
  balance: number;    // بیلانس فعلی (مجموع واریز منهای برداشت)
  createdAt: string;  // تاریخ ثبت
};

// تراکنش واریز یا برداشت — صورت‌حساب هر حساب
type Transaction = {
  id: string;
  accountId: string;
  type: "deposit" | "withdraw"; // واریز | برداشت
  amount: number;
  note: string;
  date: string;                 // تاریخ شمسی/محلی خوانا
  ts: number;                   // timestamp برای مرتب‌سازی
};

const CURRENCY_NAMES: Record<string, string> = {
  TOM: "تومان",
  AFN: "افغانی",
  EUR: "یورو",
  USD: "دالر",
  KANDAR: "کالدار",
};

// پنج ارز — کارت بالای صفحه
const CRYPTOS = [
  { symbol: "TOM",   name: "تومان",            icon: "🎟️", color: "text-emerald-600" },
  { symbol: "AFN",   name: "افغانی",           icon: "🇦🇫", color: "text-sky-600" },
  { symbol: "EUR",   name: "یورو",             icon: "💶", color: "text-amber-600" },
  { symbol: "USD",   name: "دالر",             icon: "💵", color: "text-green-600" },
  { symbol: "KANDAR",name: "کالدار",           icon: "🧱", color: "text-red-600" },
];

const EMPTY_FORM: Omit<SecretAccount, "id" | "createdAt" | "balance"> = {
  name: "",
  wald: "",
  phone: "",
  address: "",
  currency: "TOM",
};

// 🔴 تبدیل هر رکورد خام Firestore به فرمت امن صفحه
function toAccount(raw: any): SecretAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  return {
    id: String(raw.id ?? ""),
    name,
    wald: String(raw.wald ?? ""),
    phone: String(raw.phone ?? ""),
    address: String(raw.address ?? ""),
    currency: String(raw.currency ?? "TOM"),
    balance: Number(raw.balance ?? 0),
    createdAt:
      typeof raw.createdAt === "number"
        ? new Date(raw.createdAt).toLocaleString("fa-AF")
        : String(raw.createdAt ?? ""),
  };
}

// 🔴 تبدیل تراکنش خام به فرمت امن
function toTransaction(raw: any): Transaction | null {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number(raw.amount ?? 0);
  if (!isFinite(amount) || amount <= 0) return null;
  const ts = Number(raw.ts ?? 0);
  return {
    id: String(raw.id ?? ""),
    accountId: String(raw.accountId ?? ""),
    type: raw.type === "withdraw" ? "withdraw" : "deposit",
    amount,
    note: String(raw.note ?? ""),
    date:
      typeof raw.date === "string" && raw.date
        ? raw.date
        : ts
        ? new Date(ts).toLocaleString("fa-AF")
        : "",
    ts,
  };
}

// 🔴 مرتب‌سازی: جدیدترین بالا (id رشته‌ای با timestamp_ شروع می‌شود)
function sortDesc(list: SecretAccount[]): SecretAccount[] {
  return [...list].sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

const STORAGE_KEY = "secret_accounts_local_v1";
const TX_STORAGE_KEY = "secret_transactions_local_v1";

export default function SecretAccountsPage() {
  // 🔴 صبر تا Firebase Auth وضعیت کاربر را مشخص کند.
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    if (auth.currentUser) {
      setUid(auth.currentUser.uid);
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // لیست — ابتدا از localStorage (فوری)، سپس همگام با Firestore
  const [accounts, setAccounts] = useState<SecretAccount[]>([]);
  const [loaded, setLoaded] = useState(false);

  // تراکنش‌های واریز/برداشت — صورت‌حساب
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  // فرم واریز/برداشت
  const [txForm, setTxForm] = useState({
    accountId: "",
    type: "deposit" as "deposit" | "withdraw",
    amount: "",
    note: "",
  });
  const [txSaving, setTxSaving] = useState(false);
  const [openStatementId, setOpenStatementId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // 🔴 بارگذاری فوری از localStorage + کش سراسری (جلوگیری از پرش لیست هنگام رندر)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed.map(toAccount).filter(Boolean) as SecretAccount[]
          : [];
        setAccounts(sortDesc(list));
      }
      const rawTx = localStorage.getItem(TX_STORAGE_KEY);
      if (rawTx) {
        const parsedTx = JSON.parse(rawTx);
        if (Array.isArray(parsedTx)) {
          setTransactions(
            parsedTx.map(toTransaction).filter(Boolean) as Transaction[]
          );
        }
      }
    } catch {}
    setLoaded(true);
  }, []);

  // 🔴 خواندن مستقیم یک‌باره از Firestore (getDocs به جای هوک پیچیده)
  useEffect(() => {
    if (!db || !uid) return;
    let cancelled = false;
    (async () => {
      try {
        console.log(`🔵 [secret-accounts] در حال خواندن از Firestore برای کاربر ${uid}...`);
        const { collection, getDocs } = await import("firebase/firestore");
        const [snapAcc, snapTx] = await Promise.all([
          getDocs(collection(db!, "users", uid, "secret_accounts")),
          getDocs(collection(db!, "users", uid, "secret_transactions")).catch(() => null),
        ]);
        if (cancelled) return;
        const list = snapAcc.docs
          .map((d) => toAccount({ id: d.id, ...d.data() }))
          .filter(Boolean) as SecretAccount[];
        const sorted = sortDesc(list);
        console.log(`🟢 [secret-accounts] خوانده شد ${sorted.length} حساب از Firestore.`);
        setAccounts(sorted);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
        } catch {}

        // تراکنش‌ها — صورت‌حساب
        const txList = snapTx
          ? (snapTx.docs
              .map((d) => toTransaction({ id: d.id, ...d.data() }))
              .filter(Boolean) as Transaction[])
          : [];
        txList.sort((a, b) => b.ts - a.ts);
        setTransactions(txList);
        try {
          localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(txList));
        } catch {}
      } catch (err) {
        console.error("🔴 [secret-accounts] خطا در خواندن Firestore:", err);
        if (!cancelled) showToast("⚠️ خواندن از سرور ناموفق بود — نسخه محلی نمایش داده می‌شود");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // 🔴 فیلتر امن: اگر یک رکورد قدیمی بدون name در Firestore وجود داشته باشد،
  // برنامه نباید کرش کند — آن را نادیده می‌گیریم.
  const validAccounts = accounts.filter(
    (a) => a && typeof a === "object" && String(a.name ?? "").trim() !== ""
  );

  const filtered = validAccounts.filter((a) => {
    const q = search.trim();
    if (!q) return true;
    return (
      String(a.name ?? "").includes(q) ||
      String(a.wald ?? "").includes(q) ||
      String(a.phone ?? "").includes(q) ||
      String(a.address ?? "").includes(q)
    );
  });

  const submit = async () => {
    if (saving) return; // جلوگیری از دابل‌کلیک
    console.log("1. فرم سابمیت شد. داده‌ها:", form);
    if (!authReady || !auth?.currentUser) {
      showToast("⚠️ لطفاً ابتدا وارد حساب کاربری خود شوید");
      return;
    }
    if (!form.name.trim()) {
      showToast("⚠️ اسم الزامی است");
      return;
    }
    setSaving(true);

    const now = Date.now();
    const newId = `${now}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      let nextList: SecretAccount[];
      if (editingId !== null) {
        nextList = accounts.map((a) =>
          String(a.id) === String(editingId)
            ? { ...a, ...form, name: form.name.trim() }
            : a
        );
      } else {
        const newAccount: SecretAccount = {
          id: newId,
          ...form,
          name: form.name.trim(),
          balance: 0,
          createdAt: new Date(now).toLocaleString("fa-AF"),
        };
        nextList = [newAccount, ...accounts];
      }

      // 🔴 مرحله ۲: بلافاصله State را آپدیت کن — حساب همان لحظه در پایین نمایش داده می‌شود
      const sorted = sortDesc(nextList);
      setAccounts(sorted);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
      } catch {}

      // 🔴 مرحله ۱/۳: نوشتن مستقیم تک‌سند در Firestore users/{uid}/secret_accounts
      const currentUid = auth.currentUser.uid;
      const targetId = editingId !== null ? String(editingId) : newId;
      const record = sorted.find((a) => String(a.id) === targetId);
      if (db && record) {
        console.log("2. در حال ارسال به Firestore...");
        const docRef = doc(db, "users", currentUid, "secret_accounts", targetId);
        await setDoc(docRef, {
          name: record.name,
          wald: record.wald,
          phone: record.phone,
          address: record.address,
          currency: record.currency,
          balance: record.balance ?? 0,
          createdAt: record.createdAt,
          updatedAt: now,
        });
        console.log("3. با موفقیت در Firestore ذخیره شد. ID:", targetId);
      }

      setEditingId(null);
      setForm(EMPTY_FORM);
      showToast(editingId !== null ? "✅ حساب ویرایش شد" : "✅ حساب ثبت شد و در فهرست پایین نمایش داده می‌شود");
    } catch (error) {
      console.error("4. خطا در ذخیره‌سازی:", error);
      showToast("❌ خطا در ذخیره‌سازی — لیست محلی حفظ شد، اینترنت را بررسی کنید");
    } finally {
      setSaving(false);
    }
  };

  const edit = (acc: SecretAccount) => {
    setForm({
      name: acc.name || "",
      wald: acc.wald || "",
      phone: acc.phone || "",
      address: acc.address || "",
      currency: acc.currency || "TOM",
    });
    setEditingId(acc.id);
  };

  // 🔴 محاسبه بیلانس از روی تراکنش‌ها (منبع حقیقت = صورت‌حساب)
  const balanceOf = (accountId: string): number =>
    transactions
      .filter((t) => t.accountId === String(accountId))
      .reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);

  // 🔴 ثبت واریز / برداشت
  const submitTx = async () => {
    if (txSaving) return;
    if (!authReady || !auth?.currentUser) {
      showToast("⚠️ لطفاً ابتدا وارد حساب کاربری خود شوید");
      return;
    }
    const acc = validAccounts.find((a) => String(a.id) === txForm.accountId);
    if (!acc) {
      showToast("⚠️ لطفاً یک حساب را انتخاب کنید");
      return;
    }
    const amount = Number(txForm.amount);
    if (!isFinite(amount) || amount <= 0) {
      showToast("⚠️ مبلغ باید یک عدد بزرگ‌تر از صفر باشد");
      return;
    }
    if (txForm.type === "withdraw" && balanceOf(String(acc.id)) < amount) {
      showToast("⚠️ بیلانس این حساب کافی نیست");
      return;
    }
    setTxSaving(true);

    const now = Date.now();
    const txId = `${now}_${Math.random().toString(36).slice(2, 8)}`;
    const newTx: Transaction = {
      id: txId,
      accountId: String(acc.id),
      type: txForm.type,
      amount,
      note: txForm.note.trim(),
      date: new Date(now).toLocaleString("fa-AF"),
      ts: now,
    };

    try {
      // ۱. آپدیت فوری State — تراکنش همان لحظه در صورت‌حساب دیده می‌شود
      const nextTx = [newTx, ...transactions];
      setTransactions(nextTx);
      try {
        localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(nextTx));
      } catch {}

      // ۲. ذخیره تراکنش و سپس بیلانس جدید در Firestore
      const currentUid = auth.currentUser.uid;
      if (db) {
        await setDoc(doc(db, "users", currentUid, "secret_transactions", txId), {
          accountId: newTx.accountId,
          type: newTx.type,
          amount: newTx.amount,
          note: newTx.note,
          date: newTx.date,
          ts: newTx.ts,
        });
        const newBalance = balanceOfFromList(nextTx, acc.id);
        await setDoc(
          doc(db, "users", currentUid, "secret_accounts", String(acc.id)),
          {
            name: acc.name,
            wald: acc.wald,
            phone: acc.phone,
            address: acc.address,
            currency: acc.currency,
            balance: newBalance,
            createdAt: acc.createdAt,
            updatedAt: now,
          },
          { merge: true }
        );
        setAccounts((prev) =>
          prev.map((a) =>
            String(a.id) === String(acc.id) ? { ...a, balance: newBalance } : a
          )
        );
      }

      setTxForm({ accountId: txForm.accountId, type: txForm.type, amount: "", note: "" });
      showToast(
        txForm.type === "deposit"
          ? `✅ ${amount.toLocaleString()} واریز شد به «${acc.name}»`
          : `✅ ${amount.toLocaleString()} از «${acc.name}» برداشت شد`
      );
    } catch (error) {
      console.error("❌ خطا در ثبت تراکنش:", error);
      showToast("❌ خطا در ذخیره‌سازی تراکنش — اینترنت را بررسی کنید");
    } finally {
      setTxSaving(false);
    }
  };

  // حذف تراکنش از صورت‌حساب + بازمحاسبه بیلانس
  const removeTx = async (txId: string) => {
    const target = transactions.find((t) => String(t.id) === String(txId));
    const nextTx = transactions.filter((t) => String(t.id) !== String(txId));
    setTransactions(nextTx);
    try {
      localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(nextTx));
    } catch {}
    if (target && db && auth?.currentUser) {
      try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "secret_transactions", String(txId)));
        const newBalance = balanceOfFromList(nextTx, target.accountId);
        await setDoc(
          doc(db, "users", auth.currentUser.uid, "secret_accounts", target.accountId),
          { balance: newBalance, updatedAt: Date.now() },
          { merge: true }
        );
        setAccounts((prev) =>
          prev.map((a) =>
            String(a.id) === target.accountId ? { ...a, balance: newBalance } : a
          )
        );
      } catch (err) {
        console.error("🔴 خطا در حذف تراکنش:", err);
      }
    }
    showToast("🗑️ تراکنش حذف شد");
  };

  const balanceOfFromList = (list: Transaction[], accountId: string | number): number =>
    list
      .filter((t) => t.accountId === String(accountId))
      .reduce((s, t) => s + (t.type === "deposit" ? t.amount : -t.amount), 0);

  const remove = async (id: string | number) => {
    // 🔴 حذف فوری از State و localStorage، سپس از Firestore
    const nextList = accounts.filter((a) => String(a.id) !== String(id));
    setAccounts(nextList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch {}
    if (db && auth?.currentUser) {
      try {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "secret_accounts", String(id)));
      } catch (err) {
        console.error("🔴 [secret-accounts] خطا در حذف از Firestore:", err);
      }
    }
    if (editingId !== null && String(editingId) === String(id)) {
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
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">ولد</span>
            <input
              className={inputCls}
              value={form.wald}
              onChange={(e) => setForm({ ...form, wald: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">شماره</span>
            <input
              className={inputCls}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">آدرس</span>
            <input
              className={inputCls}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">ارز</span>
            <select
              className={inputCls}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            >
              {CRYPTOS.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.icon} {c.name} ({c.symbol})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "در حال ثبت…" : editingId !== null ? "ذخیره تغییرات" : "افزودن"}
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

      {/* بخش واریز و برداشت */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">💸 واریز و برداشت</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-semibold text-slate-700">حساب مشتری *</span>
            <select
              className={inputCls}
              value={txForm.accountId}
              onChange={(e) => setTxForm({ ...txForm, accountId: e.target.value })}
            >
              <option value="">— انتخاب حساب —</option>
              {validAccounts.map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {a.name}{a.wald ? ` (${a.wald})` : ""} — بیلانس: {(balanceOf(String(a.id)) || a.balance || 0).toLocaleString()} {CURRENCY_NAMES[a.currency] ?? a.currency}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">نوع عملیات</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTxForm({ ...txForm, type: "deposit" })}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  txForm.type === "deposit"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ⬇️ واریز
              </button>
              <button
                type="button"
                onClick={() => setTxForm({ ...txForm, type: "withdraw" })}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  txForm.type === "withdraw"
                    ? "bg-red-600 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ⬆️ برداشت
              </button>
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">مبلغ *</span>
            <input
              className={inputCls}
              inputMode="numeric"
              dir="ltr"
              value={txForm.amount}
              onChange={(e) =>
                setTxForm({ ...txForm, amount: e.target.value.replace(/[^\d.]/g, "") })
              }
              onKeyDown={(e) => e.key === "Enter" && submitTx()}
            />
          </label>
          <label className="block space-y-1.5 md:col-span-2">
            <span className="text-xs font-semibold text-slate-700">توضیحات (اختیاری)</span>
            <input
              className={inputCls}
              value={txForm.note}
              onChange={(e) => setTxForm({ ...txForm, note: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && submitTx()}
            />
          </label>
        </div>
        <button
          onClick={submitTx}
          disabled={txSaving || !txForm.accountId}
          className={`rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
            txForm.type === "deposit" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {txSaving
            ? "در حال ثبت…"
            : txForm.type === "deposit"
            ? "⬇️ ثبت واریز"
            : "⬆️ ثبت برداشت"}
        </button>
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

      {!loaded || !authReady ? (
        <p className="text-sm text-slate-400">در حال بارگذاری…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
          {validAccounts.length === 0
            ? "هنوز حسابی ثبت نشده است. اولین حساب را از فرم بالا اضافه کنید."
            : "هیچ حسابی با این جستجو یافت نشد."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((acc) => {
            const key = String(acc.id);
            const accTx = transactions.filter((t) => t.accountId === key);
            const liveBalance = accTx.length > 0 ? balanceOf(key) : (acc.balance || 0);
            const curName = CURRENCY_NAMES[acc.currency] ?? acc.currency;
            const isOpen = openStatementId === key;
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

                {/* بیلانس و ارز */}
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                  <span className="text-xs text-slate-500">ارز: {acc.currency} ({curName})</span>
                  <span
                    className={`text-sm font-bold ${liveBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    dir="ltr"
                  >
                    💰 {liveBalance.toLocaleString()} {curName}
                  </span>
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

                <div className="flex gap-2 pt-1 flex-wrap">
                  <button
                    onClick={() => edit(acc)}
                    className="text-xs rounded-lg bg-sky-600/80 hover:bg-sky-600 px-3 py-1.5 text-white transition-colors"
                  >
                    ✏️ ویرایش
                  </button>
                  <button
                    onClick={() => {
                      setTxForm({ ...txForm, accountId: key });
                      setOpenStatementId(isOpen ? null : key);
                    }}
                    className="text-xs rounded-lg bg-violet-600/80 hover:bg-violet-600 px-3 py-1.5 text-white transition-colors"
                  >
                    🧾 صورت‌حساب ({accTx.length})
                  </button>
                  <button
                    onClick={() => remove(acc.id)}
                    className="text-xs rounded-lg bg-red-600/80 hover:bg-red-600 px-3 py-1.5 text-white transition-colors"
                  >
                    🗑 حذف
                  </button>
                </div>

                {/* 🔴 صورت‌حساب — تاریخ، ساعت، نوع، مقدار */}
                {isOpen && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">
                      🧾 صورت‌حساب «{acc.name}» — {accTx.length} تراکنش
                    </h4>
                    {accTx.length === 0 ? (
                      <p className="text-xs text-slate-500">هنوز تراکنشی ثبت نشده است.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {accTx.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span
                                className={`font-bold ${
                                  t.type === "deposit" ? "text-emerald-600" : "text-red-600"
                                }`}
                              >
                                {t.type === "deposit" ? "⬇️ واریز" : "⬆️ برداشت"}
                              </span>
                              <span className="text-slate-800 font-medium" dir="ltr">
                                {t.amount.toLocaleString()} {curName}
                              </span>
                              <span className="text-slate-500" dir="ltr">
                                🕐 {t.date}
                              </span>
                              {t.note && (
                                <span className="text-slate-400 truncate max-w-[140px]">
                                  ({t.note})
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => removeTx(t.id)}
                              className="text-[11px] rounded-md bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 shrink-0"
                            >
                              حذف
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
