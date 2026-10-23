"use client";

import { useState, useEffect, type ReactNode } from "react";
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

  // 🎨 استایل‌های مشترک — هماهنگ با تب صندوق (cash)
  const inputShell =
    "rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10";
  const inputCls = `w-full h-12 px-3.5 ${inputShell}`;
  const uiCard =
    "rounded-2xl border backdrop-blur transition-colors duration-300 border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]";
  const uiLabel = "mb-1.5 block text-[11px] font-black tracking-wide text-slate-500";
  const fld = (label: string, node: ReactNode, cls = "") => (
    <div className={cls}>
      <label className={uiLabel}>{label}</label>
      {node}
    </div>
  );

  return (
    <div dir="rtl" className="sa-font relative min-h-screen overflow-x-hidden antialiased bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-slate-800">
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap");.sa-font{font-family:"Vazirmatn","Segoe UI",Tahoma,sans-serif}.sa-display{font-family:"Lalezar","Vazirmatn",Tahoma,sans-serif;letter-spacing:.01em}@keyframes saUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.sa-up{animation:saUp .5s cubic-bezier(.22,.8,.35,1) both}::selection{background:rgba(16,185,129,.25)}`}</style>
      {/* نوار رنگی بالای صفحه */}
      <div className="fixed inset-x-0 top-0 z-30 h-1 bg-gradient-to-l from-emerald-500 via-teal-500 to-cyan-500" />

      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-4 md:space-y-6 px-3 pb-16 pt-5 md:px-8 md:pt-9">
        {/* هدر */}
        <header className="sa-up flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
            <div className="grid h-11 w-11 md:h-14 md:w-14 shrink-0 place-items-center rounded-xl md:rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-400 text-white text-xl md:text-2xl shadow-lg shadow-emerald-500/30 ring-1 ring-white/30">🔐</div>
            <div className="min-w-0">
              <h1 className="sa-display text-2xl md:text-4xl leading-none text-slate-900">حسابات رمزی</h1>
              <p className="mt-1 text-[10px] md:text-xs font-bold text-slate-400">نگهداری امن معلومات مشتریان — فقط مخصوص شما</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white/85 px-3 py-2 shadow-sm backdrop-blur">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-black text-emerald-700">{validAccounts.length} حساب</span>
          </div>
        </header>

        {/* کارت پنج ارز */}
        <div className="sa-up relative overflow-hidden rounded-xl md:rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-3 md:p-4 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.25)] transition-all duration-300 hover:shadow-xl" style={{ animationDelay: "70ms" }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm shadow-md">💰</span>
            <b className="text-sm md:text-base font-black text-emerald-700">پنچ ارز</b>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
            {CRYPTOS.map((c) => (
              <div key={c.symbol} className="group relative overflow-hidden rounded-xl bg-white/90 p-2.5 md:p-3 text-center ring-1 ring-emerald-100 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                <div className="text-2xl md:text-3xl mb-1 transition-transform duration-300 group-hover:scale-110">{c.icon}</div>
                <div className={`text-[11px] md:text-sm font-black ${c.color}`} dir="ltr">{c.symbol}</div>
                <div className="text-[10px] md:text-[11px] font-bold text-slate-500">{c.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* فرم افزودن/ویرایش */}
        <div className={`sa-up ${uiCard} p-4 md:p-5 space-y-4`} style={{ animationDelay: "140ms" }}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 text-white text-sm shadow-md">{editingId !== null ? "✏️" : "➕"}</span>
            <b className="text-sm md:text-base font-black text-slate-800">{editingId !== null ? "ویرایش حساب" : "ساخت حساب جدید"}</b>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fld("اسم *", <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />)}
            {fld("ولد", <input className={inputCls} value={form.wald} onChange={(e) => setForm({ ...form, wald: e.target.value })} />)}
            {fld("شماره", <input className={inputCls} inputMode="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />)}
            {fld("آدرس", <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />)}
            {fld("ارز", (
              <select className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CRYPTOS.map((c) => (
                  <option key={c.symbol} value={c.symbol}>{c.icon} {c.name} ({c.symbol})</option>
                ))}
              </select>
            ), "md:col-span-2")}
          </div>
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="cursor-pointer rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 transition-all px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "در حال ثبت…" : editingId !== null ? "💾 ذخیره تغییرات" : "➕ افزودن حساب"}
            </button>
            {editingId !== null && (
              <button
                onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}
                className="cursor-pointer rounded-xl bg-slate-100 hover:bg-slate-200 transition-all px-5 py-2.5 text-sm font-bold text-slate-600"
              >
                انصراف
              </button>
            )}
          </div>
        </div>

        {/* بخش واریز و برداشت */}
        <div className="sa-up relative overflow-hidden rounded-xl md:rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-3 md:p-4 shadow-[0_10px_30px_-10px_rgba(139,92,246,0.25)] transition-all duration-300 hover:shadow-xl" style={{ animationDelay: "210ms" }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-white text-sm shadow-md">💸</span>
            <b className="text-sm md:text-base font-black text-violet-700">واریز و برداشت</b>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fld("حساب مشتری *", (
              <select className={inputCls} value={txForm.accountId} onChange={(e) => setTxForm({ ...txForm, accountId: e.target.value })}>
                <option value="">— انتخاب حساب —</option>
                {validAccounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {a.name}{a.wald ? ` (${a.wald})` : ""} — بیلانس: {(balanceOf(String(a.id)) || a.balance || 0).toLocaleString()} {CURRENCY_NAMES[a.currency] ?? a.currency}
                  </option>
                ))}
              </select>
            ), "md:col-span-2")}
            {fld("نوع عملیات", (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTxForm({ ...txForm, type: "deposit" })}
                  className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-black transition-all active:scale-95 ${
                    txForm.type === "deposit"
                      ? "bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  ⬇️ واریز
                </button>
                <button
                  type="button"
                  onClick={() => setTxForm({ ...txForm, type: "withdraw" })}
                  className={`cursor-pointer rounded-xl px-4 py-3 text-sm font-black transition-all active:scale-95 ${
                    txForm.type === "withdraw"
                      ? "bg-gradient-to-l from-red-600 to-rose-600 text-white shadow-lg shadow-red-500/25"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  ⬆️ برداشت
                </button>
              </div>
            ))}
            {fld("مبلغ *", (
              <input
                className={inputCls}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                dir="ltr"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              />
            ))}
            {fld("توضیحات (اختیاری)", <input className={inputCls} value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />, "md:col-span-2")}
          </div>
          <button
            onClick={submitTx}
            disabled={txSaving || !txForm.accountId}
            className={`cursor-pointer mt-1 rounded-xl px-6 py-2.5 text-sm font-black text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg ${
              txForm.type === "deposit"
                ? "bg-gradient-to-l from-emerald-600 to-teal-600 hover:brightness-110 shadow-emerald-500/25"
                : "bg-gradient-to-l from-red-600 to-rose-600 hover:brightness-110 shadow-red-500/25"
            }`}
          >
            {txSaving ? "در حال ثبت…" : txForm.type === "deposit" ? "⬇️ ثبت واریز" : "⬆️ ثبت برداشت"}
          </button>
        </div>

        {/* فهرست حسابات */}
        <div className="sa-up flex items-center gap-2" style={{ animationDelay: "280ms" }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm shadow-md">📒</span>
          <b className="text-sm md:text-base font-black text-slate-800">فهرست حسابات</b>
        </div>

        {/* جستجو — بالای فهرست */}
        <div className="relative max-w-md">
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            className={inputCls + " pr-10"}
            placeholder="اسم، ولد، شماره یا آدرس را جستجو کنید..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!loaded || !authReady ? (
          <div className="py-10 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
            <p className="mt-4 text-slate-500 text-sm font-bold">در حال بارگذاری…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-white/70 p-8 text-center text-slate-500 text-sm font-bold">
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
                <div key={key} className={`${uiCard} sa-up p-4 space-y-2.5 transition-all duration-300 hover:shadow-lg`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-black shadow-md">
                        {(CRYPTOS.find((c) => c.symbol === acc.currency)?.icon) || "👤"}
                      </span>
                      <h3 className="font-black text-slate-900 truncate">
                        {acc.name}
                        {acc.wald ? <span className="text-slate-500 font-bold"> — ولد: {acc.wald}</span> : ""}
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{acc.createdAt}</span>
                  </div>

                  {/* بیلانس و ارز */}
                  <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-100 px-3 py-2">
                    <span className="text-[11px] font-black text-slate-500">ارز: {acc.currency} ({curName})</span>
                    <span className={`text-sm font-black tabular-nums ${liveBalance >= 0 ? "text-emerald-700" : "text-red-600"}`} dir="ltr">
                      💰 {liveBalance.toLocaleString()} {curName}
                    </span>
                  </div>

                  {acc.phone && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-slate-700" dir="ltr">📞 {acc.phone}</span>
                      <button
                        onClick={() => copy(acc.phone, "شماره")}
                        className="cursor-pointer text-xs rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 font-bold text-slate-700 transition-colors"
                      >
                        📋 کپی
                      </button>
                    </div>
                  )}

                  {acc.address && <p className="text-sm font-bold text-slate-700">📍 آدرس: {acc.address}</p>}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button
                      onClick={() => edit(acc)}
                      className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-sky-600 to-cyan-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-sky-500/20 transition-all"
                    >
                      ✏️ ویرایش
                    </button>
                    <button
                      onClick={() => {
                        setTxForm({ ...txForm, accountId: key });
                        setOpenStatementId(isOpen ? null : key);
                      }}
                      className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-violet-600 to-indigo-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-violet-500/20 transition-all"
                    >
                      🧾 صورت‌حساب ({accTx.length})
                    </button>
                    <button
                      onClick={() => remove(acc.id)}
                      className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-red-600 to-rose-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-red-500/20 transition-all"
                    >
                      🗑 حذف
                    </button>
                  </div>

                  {/* صورت‌حساب — تاریخ، ساعت، نوع، مقدار */}
                  {isOpen && (
                    <div className="mt-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-3 space-y-2">
                      <h4 className="text-xs font-black text-violet-700">
                        🧾 صورت‌حساب «{acc.name}» — {accTx.length} تراکنش
                      </h4>
                      {accTx.length === 0 ? (
                        <p className="text-xs font-bold text-slate-500">هنوز تراکنشی ثبت نشده است.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {accTx.map((t) => (
                            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs shadow-sm">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`rounded-md px-2 py-0.5 font-black ${t.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                  {t.type === "deposit" ? "⬇️ واریز" : "⬆️ برداشت"}
                                </span>
                                <span className="text-slate-800 font-black tabular-nums" dir="ltr">{t.amount.toLocaleString()} {curName}</span>
                                <span className="text-slate-500 font-bold" dir="ltr">🕐 {t.date}</span>
                                {t.note && <span className="text-slate-400 truncate max-w-[140px]">({t.note})</span>}
                              </div>
                              <button
                                onClick={() => removeTx(t.id)}
                                className="cursor-pointer text-[11px] rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 shrink-0 transition-colors"
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
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 border border-slate-700 px-5 py-3 text-sm font-bold text-white shadow-2xl">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
