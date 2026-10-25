"use client";

import { useState, useEffect, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// ============================================================
// انواع داده (Types)
// ============================================================
type SecretAccount = {
  id: string | number;
  name: string;
  wald: string;
  phone: string;
  address: string;
  currency: string;
  balance: number;
  createdAt: string;
};

type Transaction = {
  id: string;
  accountId: string;
  type: "deposit" | "withdraw";
  amount: number;
  note: string;
  date: string;
  day: string;
  time: string;
  transferNo: string;
  currency: string;
  cardNumber?: string;      // برای سازگاری با نسخه‌های قبلی
  cardReference?: string;   // فیلد جدید: ۶ رقم آخر کارت / کد پیگیری
  contactNumber?: string;
  shamsiDisplay?: string;   // فیلد جدید: نمایشگر شمسی
  ts: number;
};

// ============================================================
// توابع کمکی (Helpers)
// ============================================================
const toFaDigits = (s: string | number) => String(s).replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[Number(x)]);

// فرمت کردن مبلغ با جداکننده هزارگان و اعداد فارسی
const formatAmount = (value: string) => {
  const numericValue = value.replace(/[^\d]/g, "");
  if (!numericValue) return "";
  return toFaDigits(Number(numericValue).toLocaleString("en-US"));
};

// دریافت تاریخ و ساعت شمسی فعلی
const getCurrentShamsiDateTime = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return toFaDigits(formatter.format(now).replace(/,/g, ""));
};

function fmtDateTime(ts: number) {
  const d = new Date(ts);
  return {
    date: toFaDigits(d.toLocaleDateString("fa-AF")),
    day: d.toLocaleDateString("fa-AF", { weekday: "long" }),
    time: toFaDigits(d.toLocaleTimeString("fa-AF", { hour: "2-digit", minute: "2-digit", second: "2-digit" })),
  };
}

function genTransferNo(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `HV-${ymd}-${rnd}`;
}

const CURRENCY_NAMES: Record<string, string> = {
  IRR: "تومان",
  AFN: "افغانی",
  EUR: "یورو",
  USD: "دالر",
  PKR: "کلدار",
  TOM: "تومان", // برای سازگاری با داده‌های قدیمی
  KANDAR: "کلدار", // برای سازگاری با داده‌های قدیمی
};

const CRYPTOS = [
  { symbol: "IRR", name: "تومان", icon: "🎟️", color: "text-emerald-600" },
  { symbol: "AFN", name: "افغانی", icon: "🇦🇫", color: "text-sky-600" },
  { symbol: "EUR", name: "یورو", icon: "💶", color: "text-amber-600" },
  { symbol: "USD", name: "دالر", icon: "💵", color: "text-green-600" },
  { symbol: "PKR", name: "کلدار", icon: "🧱", color: "text-red-600" },
];

const EMPTY_FORM: Omit<SecretAccount, "id" | "createdAt" | "balance"> = {
  name: "", wald: "", phone: "", address: "", currency: "AFN",
};

function toAccount(raw: any): SecretAccount | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  return {
    id: String(raw.id ?? ""), name,
    wald: String(raw.wald ?? ""), phone: String(raw.phone ?? ""),
    address: String(raw.address ?? ""),
    currency: String(raw.currency ?? "AFN"),
    balance: Number(raw.balance ?? 0),
    createdAt: typeof raw.createdAt === "number" ? new Date(raw.createdAt).toLocaleString("fa-AF") : String(raw.createdAt ?? ""),
  };
}

function toTransaction(raw: any): Transaction | null {
  if (!raw || typeof raw !== "object") return null;
  const amount = Number(raw.amount ?? 0);
  if (!isFinite(amount) || amount <= 0) return null;
  const ts = Number(raw.ts ?? 0);
  const parts = fmtDateTime(ts || Date.now());
  return {
    id: String(raw.id ?? ""), accountId: String(raw.accountId ?? ""),
    type: raw.type === "withdraw" ? "withdraw" : "deposit",
    amount, note: String(raw.note ?? ""),
    date: typeof raw.date === "string" && raw.date ? raw.date : parts.date,
    day: typeof raw.day === "string" && raw.day ? raw.day : parts.day,
    time: typeof raw.time === "string" && raw.time ? raw.time : parts.time,
    transferNo: typeof raw.transferNo === "string" && raw.transferNo ? raw.transferNo : genTransferNo(),
    currency: String(raw.currency ?? ""),
    cardNumber: String(raw.cardNumber ?? ""),
    cardReference: String(raw.cardReference ?? raw.cardNumber ?? ""), // پشتیبانی از هر دو فیلد
    contactNumber: String(raw.contactNumber ?? ""),
    shamsiDisplay: typeof raw.shamsiDisplay === "string" ? raw.shamsiDisplay : `${parts.date} ${parts.time}`,
    ts,
  };
}

function sortDesc(list: SecretAccount[]): SecretAccount[] {
  return [...list].sort((a, b) => String(b.id).localeCompare(String(a.id)));
}

const STORAGE_KEY = "secret_accounts_local_v1";
const TX_STORAGE_KEY = "secret_transactions_local_v1";

// ============================================================
// کامپوننت اصلی
// ============================================================
export default function SecretAccountsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [accounts, setAccounts] = useState<SecretAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  // فرم واریز/برداشت جدید
  const [txForm, setTxForm] = useState({
    accountId: "",
    type: "deposit" as "deposit" | "withdraw",
    amount: "",
    shamsiDateTime: getCurrentShamsiDateTime(),
    cardReference: "",
    note: "",
  });
  const [txSaving, setTxSaving] = useState(false);
  const [openStatementId, setOpenStatementId] = useState<string | null>(null);

  // دیالوگ تأیید حذف داخلی
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; type: "account" | "transaction"; id: string; accountId?: string } | null>(null);

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    if (auth.currentUser) { setUid(auth.currentUser.uid); setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // بارگذاری فوری از localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAccounts(sortDesc(JSON.parse(raw).map(toAccount).filter(Boolean)));
      const rawTx = localStorage.getItem(TX_STORAGE_KEY);
      if (rawTx) setTransactions(JSON.parse(rawTx).map(toTransaction).filter(Boolean));
    } catch {}
    setLoaded(true);
  }, []);

  // همگام‌سازی لحظه‌ای (Real-time) با Firestore
  useEffect(() => {
    if (!db || !uid) return;
    
    const qAccounts = query(collection(db, "users", uid, "secret_accounts"), orderBy("createdAt", "desc"));
    const qTransactions = query(collection(db, "users", uid, "secret_transactions"), orderBy("ts", "desc"));

    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const list = snapshot.docs.map(d => toAccount({ id: d.id, ...d.data() })).filter(Boolean) as SecretAccount[];
      setAccounts(sortDesc(list));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
    });

    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      const list = snapshot.docs.map(d => toTransaction({ id: d.id, ...d.data() })).filter(Boolean) as Transaction[];
      setTransactions(list);
      try { localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(list)); } catch {}
    });

    return () => { unsubAccounts(); unsubTransactions(); };
  }, [uid]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const validAccounts = accounts.filter((a) => a && typeof a === "object" && String(a.name ?? "").trim() !== "");
  const filtered = validAccounts.filter((a) => {
    const q = search.trim();
    if (!q) return true;
    return [a.name, a.wald, a.phone, a.address].some(f => String(f ?? "").includes(q));
  });

  const balanceOf = (accountId: string): number =>
    transactions.filter((t) => t.accountId === String(accountId))
      .reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);

  // --- مدیریت حساب‌ها ---
  const submit = async () => {
    if (saving || !authReady || !auth?.currentUser || !form.name.trim()) {
      showToast("⚠️ اسم الزامی است");
      return;
    }
    setSaving(true);
    const now = Date.now();
    const newId = editingId !== null ? String(editingId) : `${now}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      let nextList: SecretAccount[];
      if (editingId !== null) {
        nextList = accounts.map((a) => String(a.id) === newId ? { ...a, ...form, name: form.name.trim() } : a);
      } else {
        nextList = [{ id: newId, ...form, name: form.name.trim(), balance: 0, createdAt: new Date(now).toLocaleString("fa-AF") }, ...accounts];
      }
      
      setAccounts(sortDesc(nextList));
      const currentUid = auth.currentUser.uid;
      await setDoc(doc(db, "users", currentUid, "secret_accounts", newId), {
        ...form, name: form.name.trim(),
        balance: editingId !== null ? accounts.find(a => String(a.id) === newId)?.balance ?? 0 : 0,
        createdAt: editingId !== null ? accounts.find(a => String(a.id) === newId)?.createdAt : new Date(now).toLocaleString("fa-AF"),
        updatedAt: now,
      });

      setEditingId(null);
      setForm(EMPTY_FORM);
      showToast(editingId !== null ? "✅ حساب ویرایش شد" : "✅ حساب ثبت شد");
    } catch (error) {
      console.error("4. خطا در ذخیره‌سازی حساب:", error);
      showToast("❌ خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (type: "account" | "transaction", id: string, accountId?: string) => {
    setConfirmDialog({ show: true, type, id, accountId });
  };

  const executeDelete = async () => {
    if (!confirmDialog || !auth?.currentUser) return;
    const { type, id, accountId } = confirmDialog;
    
    try {
      if (type === "account") {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "secret_accounts", String(id)));
        // حذف تراکنش‌های مرتبط
        const txs = transactions.filter(t => t.accountId === String(id));
        for (const tx of txs) {
          await deleteDoc(doc(db, "users", auth.currentUser.uid, "secret_transactions", tx.id));
        }
        showToast("🗑️ حساب و سوابق آن حذف شد");
      } else {
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "secret_transactions", String(id)));
        showToast("🗑️ تراکنش حذف شد");
      }
    } catch (err) {
      console.error("خطا در حذف:", err);
      showToast("❌ خطا در حذف");
    } finally {
      setConfirmDialog(null);
    }
  };

  // --- مدیریت تراکنش‌ها (طبق درخواست جدید) ---
  const submitTx = async () => {
    if (txSaving || !authReady || !auth?.currentUser) {
      showToast("⚠️ لطفاً ابتدا وارد حساب کاربری خود شوید");
      return;
    }
    
    const acc = validAccounts.find((a) => String(a.id) === txForm.accountId);
    if (!acc) { showToast("⚠️ لطفاً یک حساب را انتخاب کنید"); return; }
    
    const numericAmount = Number(txForm.amount.replace(/[^\d]/g, ""));
    if (!isFinite(numericAmount) || numericAmount <= 0) {
      showToast("⚠️ مبلغ باید یک عدد بزرگ‌تر از صفر باشد");
      return;
    }
    if (txForm.type === "withdraw" && balanceOf(String(acc.id)) < numericAmount) {
      showToast("⚠️ بیلانس این حساب کافی نیست");
      return;
    }
    if (txForm.cardReference.length !== 6) {
      showToast("⚠️ ۶ رقم آخر کارت / کد پیگیری باید دقیقاً ۶ عدد باشد");
      return;
    }

    const formDataLog = {
      amount: txForm.amount,
      currency: acc.currency,
      type: txForm.type,
      shamsiDateTime: txForm.shamsiDateTime,
      cardReference: txForm.cardReference,
      note: txForm.note,
    };
    console.log("1. فرم سابمیت شد:", formDataLog);

    setTxSaving(true);
    const now = Date.now();
    const txId = `${now}_${Math.random().toString(36).slice(2, 8)}`;
    const parts = fmtDateTime(now);

    const newTx: Transaction = {
      id: txId,
      accountId: String(acc.id),
      type: txForm.type,
      amount: numericAmount,
      note: txForm.note.trim(),
      date: parts.date,
      day: parts.day,
      time: parts.time,
      transferNo: genTransferNo(),
      currency: acc.currency,
      cardReference: txForm.cardReference.trim(),
      cardNumber: txForm.cardReference.trim(), // برای سازگاری با کدهای قدیمی
      shamsiDisplay: txForm.shamsiDateTime,
      ts: now,
    };

    try {
      console.log("2. در حال ذخیره در Firestore...");
      
      const txData = {
        accountId: newTx.accountId,
        type: newTx.type,
        amount: newTx.amount,
        currency: newTx.currency,
        cardReference: newTx.cardReference,
        cardNumber: newTx.cardNumber,
        shamsiDisplay: newTx.shamsiDisplay,
        note: newTx.note,
        transferNo: newTx.transferNo,
        timestamp: serverTimestamp(),
        userId: auth.currentUser.uid,
        ts: newTx.ts,
      };

      await setDoc(doc(db, "users", auth.currentUser.uid, "secret_transactions", txId), txData);
      
      // به‌روزرسانی بیلانس حساب
      const newBalance = balanceOf(String(acc.id)) + (txForm.type === "deposit" ? numericAmount : -numericAmount);
      await setDoc(doc(db, "users", auth.currentUser.uid, "secret_accounts", String(acc.id)), {
        balance: newBalance,
        updatedAt: now,
      }, { merge: true });

      console.log("3. با موفقیت ذخیره شد. ID:", txId);
      
      setTxForm(prev => ({ 
        ...prev, 
        amount: "", 
        cardReference: "", 
        note: "", 
        shamsiDateTime: getCurrentShamsiDateTime() 
      }));
      
      showToast(txForm.type === "deposit" 
        ? `✅ ${toFaDigits(numericAmount.toLocaleString())} واریز شد — حواله ${newTx.transferNo}`
        : `✅ ${toFaDigits(numericAmount.toLocaleString())} برداشت شد — حواله ${newTx.transferNo}`
      );
    } catch (error) {
      console.error("4. خطا:", error);
      showToast("❌ خطا در ذخیره‌سازی تراکنش — اینترنت را بررسی کنید");
    } finally {
      setTxSaving(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`📋 ${label} کپی شد`);
    } catch {
      showToast("❌ کپی ناموفق بود");
    }
  };

  // 🎨 استایل‌های مشترک
  const inputShell = "rounded-xl border text-sm font-medium shadow-sm outline-none transition-all duration-200 focus:ring-4 border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 hover:border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/10";
  const inputCls = `w-full h-12 px-3.5 ${inputShell}`;
  const uiCard = "rounded-2xl border backdrop-blur transition-colors duration-300 border-emerald-100 bg-white/95 shadow-[0_16px_40px_-28px_rgba(16,185,129,0.35)]";
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
            <b className="text-sm md:text-base font-black text-emerald-700">پنج ارز پشتیبانی شده</b>
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

        {/* فرم افزودن/ویرایش حساب */}
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
                {CRYPTOS.map((c) => (<option key={c.symbol} value={c.symbol}>{c.icon} {c.name} ({c.symbol})</option>))}
              </select>
            ), "md:col-span-2")}
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className="cursor-pointer rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 transition-all px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? "در حال ثبت…" : editingId !== null ? "💾 ذخیره تغییرات" : "➕ افزودن حساب"}
            </button>
            {editingId !== null && (
              <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} className="cursor-pointer rounded-xl bg-slate-100 hover:bg-slate-200 transition-all px-5 py-2.5 text-sm font-bold text-slate-600">انصراف</button>
            )}
          </div>
        </div>

        {/* بخش واریز و برداشت (اصلاح شده طبق درخواست) */}
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
                    {a.name}{a.wald ? ` (${a.wald})` : ""} — بیلانس: {toFaDigits((balanceOf(String(a.id)) || a.balance || 0).toLocaleString())} {CURRENCY_NAMES[a.currency] ?? a.currency}
                  </option>
                ))}
              </select>
            ), "md:col-span-2")}
            
            {/* فیلد ۱: مبلغ و انتخاب ارز */}
            <div>
              <label className={uiLabel}>مبلغ</label>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1 font-black text-lg tracking-wider`}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  value={txForm.amount}
                  onChange={(e) => setTxForm({ ...txForm, amount: formatAmount(e.target.value) })}
                  placeholder="مثلاً ۵۰,۰۰۰"
                />
                <select
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-500"
                  value={txForm.accountId ? (validAccounts.find(a => String(a.id) === txForm.accountId)?.currency || "AFN") : "AFN"}
                  disabled
                >
                  {CRYPTOS.map((c) => (<option key={c.symbol} value={c.symbol}>{c.name}</option>))}
                </select>
              </div>
            </div>

            {/* فیلد ۲: تاریخ و ساعت شمسی */}
            <div>
              <label className={uiLabel}>تاریخ و ساعت</label>
              <input
                className={inputCls}
                type="text"
                value={txForm.shamsiDateTime}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^\d\/\s:]/g, "");
                  setTxForm({ ...txForm, shamsiDateTime: toFaDigits(clean) });
                }}
                placeholder="۱۴۰۳/۰۸/۰۴ ۱۵:۳۰"
                dir="ltr"
              />
              <p className="mt-1 text-[10px] text-slate-400">فرمت: سال/ماه/روز ساعت:دقیقه</p>
            </div>

            {/* فیلد ۳: ۶ رقم آخر کارت */}
            <div className="md:col-span-2">
              <label className={uiLabel}>۶ رقم آخر کارت / کد پیگیری واریز *</label>
              <input
                className={`${inputCls} ${txForm.cardReference.length === 6 ? 'border-emerald-400 bg-emerald-50/50' : ''}`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                value={txForm.cardReference}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
                  setTxForm({ ...txForm, cardReference: raw });
                }}
                placeholder="مثلاً 123456"
                maxLength={6}
              />
              <p className="mt-1 text-[10px] text-slate-400">برای واریزهای شبا/پایا، ۶ رقم آخر کارت یا کد پیگیری را وارد کنید (دقیقاً ۶ عدد)</p>
            </div>

            {fld("توضیحات (اختیاری)", <input className={inputCls} value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />, "md:col-span-2")}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { setTxForm({ ...txForm, type: "deposit" }); submitTx(); }}
              disabled={txSaving || !txForm.accountId}
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 transition-all px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>⬇️</span> {txSaving ? "در حال ثبت…" : "ثبت واریز"}
            </button>
            <button
              onClick={() => { setTxForm({ ...txForm, type: "withdraw" }); submitTx(); }}
              disabled={txSaving || !txForm.accountId}
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-l from-red-600 to-rose-600 hover:brightness-110 active:scale-95 transition-all px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>⬆️</span> {txSaving ? "در حال ثبت…" : "ثبت برداشت"}
            </button>
          </div>
        </div>

        {/* فهرست حسابات */}
        <div className="sa-up flex items-center gap-2" style={{ animationDelay: "280ms" }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm shadow-md">📒</span>
          <b className="text-sm md:text-base font-black text-slate-800">فهرست حسابات</b>
        </div>

        <div className="relative max-w-md">
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input className={`${inputCls} pr-10`} placeholder="اسم، ولد، شماره یا آدرس را جستجو کنید..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {!loaded || !authReady ? (
          <div className="py-10 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
            <p className="mt-4 text-slate-500 text-sm font-bold">در حال بارگذاری…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-white/70 p-8 text-center text-slate-500 text-sm font-bold">
            {validAccounts.length === 0 ? "هنوز حسابی ثبت نشده است." : "هیچ حسابی با این جستجو یافت نشد."}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((acc) => {
              const key = String(acc.id);
              const accTx = transactions.filter((t) => t.accountId === key).sort((a, b) => b.ts - a.ts);
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
                      <h3 className="font-black text-slate-900 truncate">{acc.name}{acc.wald ? <span className="text-slate-500 font-bold"> — ولد: {acc.wald}</span> : ""}</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{acc.createdAt}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-100 px-3 py-2">
                    <span className="text-[11px] font-black text-slate-500">ارز: {acc.currency} ({curName})</span>
                    <span className={`text-sm font-black tabular-nums ${liveBalance >= 0 ? "text-emerald-700" : "text-red-600"}`} dir="ltr">
                      💰 {toFaDigits(liveBalance.toLocaleString())} {curName}
                    </span>
                  </div>

                  {acc.phone && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-slate-700" dir="ltr">📞 {acc.phone}</span>
                      <button onClick={() => copy(acc.phone, "شماره")} className="cursor-pointer text-xs rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 font-bold text-slate-700 transition-colors">📋 کپی</button>
                    </div>
                  )}
                  {acc.address && <p className="text-sm font-bold text-slate-700">📍 آدرس: {acc.address}</p>}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    <button onClick={() => { setForm({ name: acc.name, wald: acc.wald, phone: acc.phone, address: acc.address, currency: acc.currency }); setEditingId(acc.id); }} className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-sky-600 to-cyan-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-sky-500/20 transition-all">✏️ ویرایش</button>
                    <button onClick={() => { setTxForm({ ...txForm, accountId: key }); setOpenStatementId(isOpen ? null : key); }} className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-violet-600 to-indigo-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-violet-500/20 transition-all">🧾 صورت‌حساب ({accTx.length})</button>
                    <button onClick={() => handleDeleteRequest("account", key)} className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-red-600 to-rose-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-red-500/20 transition-all">🗑 حذف</button>
                  </div>

                  {/* صورت‌حساب */}
                  {isOpen && (
                    <div className="mt-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 to-white p-3 space-y-2">
                      <h4 className="text-xs font-black text-violet-700">🧾 صورت‌حساب «{acc.name}» — {accTx.length} تراکنش</h4>
                      {accTx.length === 0 ? (
                        <p className="text-xs font-bold text-slate-500">هنوز تراکنشی ثبت نشده است.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {accTx.map((t) => {
                            const displayCard = t.cardReference || t.cardNumber;
                            const displayDate = t.shamsiDisplay || `${t.date} ${t.time}`;
                            return (
                              <div key={t.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs shadow-sm space-y-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className={`rounded-md px-2 py-0.5 font-black ${t.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                      {t.type === "deposit" ? "🟢 واریز" : "🔴 برداشت"}
                                    </span>
                                    <span className="text-slate-800 font-black tabular-nums" dir="ltr">{toFaDigits(t.amount.toLocaleString())} {curName}</span>
                                  </div>
                                  <button onClick={() => handleDeleteRequest("transaction", t.id, key)} className="cursor-pointer text-[11px] rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 transition-colors">🗑 حذف</button>
                                </div>
                                
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-black text-indigo-700" dir="ltr">🆔 {t.transferNo}</span>
                                  {displayCard && (
                                    <span className="rounded-md bg-sky-50 px-2 py-0.5 font-black text-sky-700" dir="ltr">💳 {displayCard}</span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-3 flex-wrap text-slate-500 font-bold">
                                  <span>📅 {displayDate}</span>
                                  {t.note && <span className="text-slate-400 truncate max-w-[160px]">({t.note})</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 border border-slate-700 px-5 py-3 text-sm font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            {toast}
          </div>
        )}

        {/* Confirmation Dialog (Internal) */}
        {confirmDialog?.show && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
              <div className="mb-4 text-center text-4xl">⚠️</div>
              <h3 className="mb-2 text-center text-lg font-black text-slate-900">تأیید حذف</h3>
              <p className="mb-6 text-center text-sm font-medium text-slate-600">
                {confirmDialog.type === "account" 
                  ? "آیا از حذف این حساب و تمام سوابق تراکنش‌های آن اطمینان دارید؟ این عمل غیرقابل بازگشت است." 
                  : "آیا از حذف این تراکنش اطمینان دارید؟ موجودی حساب به صورت خودکار اصلاح خواهد شد."}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDialog(null)} className="flex-1 cursor-pointer rounded-xl bg-slate-100 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">انصراف</button>
                <button onClick={executeDelete} className="flex-1 cursor-pointer rounded-xl bg-red-600 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 hover:bg-red-700">بله، حذف شود</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
