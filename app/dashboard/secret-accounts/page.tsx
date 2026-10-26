"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
// ✅ رندر مودال در انتهای <body>: جدول صورت‌حساب داخل کانتینر scroll (overflow-auto) است و
// طبق CSS، position:fixed داخل آن نسبت به همان کانتینر قرار می‌گیرد — مودال به بالای صفحه
// پرتاب می‌شد و امکان وارد کردن تغییرات نبود. Portal این مشکل را کامل حل می‌کند.
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  addDoc,
} from "firebase/firestore";

// ✅ مسیر نسبی دقیق و تضمینی (سه مرحله به عقب تا ریشه پروژه)
import { auth, db } from "../lib/firebase";
import { useSafeSyncedState } from "../lib/useSafeSyncedState";
import { addCommas } from "@/lib/numberFormat";
// ✅ همان منطق و قالب فاکتوری که در HawalaPage (تابع shareHawala) استفاده شده است
import { generateShareText, handleShare } from "../lib/shareTemplate";

// ✅ تطبیق هویتی کد پیگیری بین تب‌ها:
// «محاسبات رمزی» کدهای TR-... تولید می‌کند و حواله‌ها کدهای OF/HW-... —
// برای اتصال یکسان، پیشوند با هم تطبیق داده می‌شود (TR ↔ OF ↔ HW).
const matchableCode = (c: string): string => {
  const s = String(c || "").trim().toUpperCase();
  return s.replace(/^(TR|OF|HW|CS)-/, "X-");
};

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
  cardNumber?: string;
  cardReference?: string;
  contactNumber?: string;
  shamsiDisplay?: string;
  ts: number;
};

// ✅ تراکنش‌های تب «محاسبات رمزی» — ذخیره در secret_accounts/{accountId}/transactions
type CurrencyCode = "AFN" | "USD" | "EUR" | "IRR" | "PKR";
type CryptoTxType = "deposit" | "withdrawal";

type CryptocalcTransaction = {
  id: string;
  accountId: string;
  amount: number;
  currency: CurrencyCode;
  type: CryptoTxType;
  cardReference: string; // ۶ رقم آخر کارت / کد پیگیری (فقط واریز)
  userId: string;
  timestampMs: number; // معادل محلی serverTimestamp برای نمایش
  shamsiDateTime: string; // تاریخ شمسی خودکار لحظه ثبت (وقت کابل)
  // ✅ فیلدهای جدید برداشت: نام برداشت‌کننده، نام پدر، شماره تلفن، نمبر تذکره
  recipientName?: string;
  fatherName?: string;
  phone?: string;
  idCard?: string;
  // ✅ حساب مبدأ برداشت (فیلد «انتخاب حساب برای برداشت») + ارز آن حساب
  withdrawAccountId?: string;
  withdrawCurrency?: CurrencyCode;
};

// ============================================================
// تبدیل تاریخ میلادی <-> شمسی (Jalali) — بدون کتابخانه خارجی
// ============================================================
function toJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

function toGregory(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  jy += jy > 979 ? -979 : 0;
  let gy = jy <= 979 ? 621 : 1600;
  let days =
    365 * jy + 78 + Math.floor(jy / 33) * Math.floor(((jy % 33) + 3) / 4) +
    ((jm - 1) < 7 ? (jm - 1) * 31 : ((jm - 1) * 30) + 6) + jd;
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    days--;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    const c = Math.floor((days - 1) / 365);
    gy += c;
    days -= c * 365 + Math.floor(c / 4);
  }
  const gm = days < 186 ? 1 + Math.floor(days / 31) : Math.floor((days - 186) / 30) + 7;
  const gd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { gy, gm, gd };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// تبدیل ارقام فارسی/عربی به لاتین — تا کاربر بتواند با هر کیبوردی عدد تایپ کند
const toLatinDigits = (s: string) =>
  s
    .replace(/[۰-۹]/g, (x) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(x)))
    .replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x)));

/** رشته datetime-local (میلادی) -> نمایش شمسی با ساعت ۱۲ ساعته مثل «۱۴۰۵/۰۷/۲۸ ۹:۳۸ ق.ظ» */
function formatShamsiFromLocal(localStr: string): string {
  if (!localStr) return "";
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return localStr;
  const j = toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const { hour, period } = to12HourLabel(d.getHours());
  return toFaDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)} ${hour}:${pad2(d.getMinutes())} ${period}`);
}

// ✅ زمان فعلی به وقت کابل (UTC+4:30) — ساعت سیستم کاربر مهم نیست
const KABUL_UTC_OFFSET_MS = 4.5 * 60 * 60 * 1000;
function kabulNow(): Date {
  // با افزودن آفست کابل به UTC، اجزای getUTC* دقیقاً ساعت و دقیقه کابل را می‌دهند
  return new Date(Date.now() + KABUL_UTC_OFFSET_MS);
}
/** ✅ تبدیل ساعت ۲۴ ساعته به فرمت ۱۲ ساعته با برچسب ق.ظ / ب.ظ */
function to12HourLabel(h24: number): { hour: number; period: string } {
  const period = h24 < 12 ? "ق.ظ" : "ب.ظ";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { hour: h12, period };
}
/** نمایش همیشه-زنده تاریخ/ساعت هجری شمسی به وقت افغانستان — فرمت ۱۲ ساعته (ق.ظ/ب.ظ) */
function formatKabulShamsi(): string {
  const d = kabulNow();
  const j = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  const { hour, period } = to12HourLabel(d.getUTCHours());
  return toFaDigits(`${j.jy}/${pad2(j.jm)}/${pad2(j.jd)} ${hour}:${pad2(d.getUTCMinutes())} ${period}`);
}
/** رشته datetime-local معادلِ ساعت کابل (برای ذخیره سازگار با منطق قبلی) */
function kabulDateTimeLocalStr(): string {
  const d = kabulNow();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// ============================================================
// توابع کمکی (Helpers)
// ============================================================
const toFaDigits = (s: string | number) => String(s).replace(/\d/g, (x) => "۰۱۲۳۴۵۶۷۸۹"[Number(x)]);

// ✅ نرمال‌سازی کد کارت: ارقام فارسی/عربی → لاتین، حذف غیرعدد، حداکثر ۶ رقم
const normalizeCardRef = (raw: string): string =>
  toLatinDigits(String(raw ?? "")).replace(/[^\d]/g, "").slice(0, 6);

// ✅ فیلتر هوشمند مبلغ: فقط ارقام را نگه می‌دارد، جداکننده هزارگان فارسی اضافه می‌کند
// و caret را حفظ می‌کند تا هنگام ویرایش (Backspace/Delete در وسط عدد) پرش مکان‌نما نداشته باشیم
const formatAmountKeepCaret = (rawValue: string, selStart: number): { text: string; caret: number } => {
  const digitsOnly = toLatinDigits(rawValue).replace(/[^\d]/g, "");
  const digitsBeforeCaret = toLatinDigits(rawValue.slice(0, selStart)).replace(/[^\d]/g, "").length;
  if (!digitsOnly) return { text: "", caret: 0 };
  const formatted = Number(digitsOnly).toLocaleString("en-US"); // مثل 50,000
  const fa = toFaDigits(formatted); // مثل ۵۰,۰۰۰
  let digitCount = 0;
  let caretPos = 0;
  for (let i = 0; i < fa.length; i++) {
    if (digitCount === digitsBeforeCaret) { caretPos = i; break; }
    if ("۰۱۲۳۴۵۶۷۸۹".includes(fa[i])) digitCount++;
    if (i === fa.length - 1) caretPos = fa.length;
  }
  return { text: fa, caret: caretPos };
};

const formatAmount = (value: string) => {
  const numericValue = toLatinDigits(value).replace(/[^\d]/g, "");
  if (!numericValue) return "";
  return toFaDigits(Number(numericValue).toLocaleString("en-US"));
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
  TOM: "تومان",
  KANDAR: "کلدار",
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
    cardReference: String(raw.cardReference ?? raw.cardNumber ?? ""),
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
  // ✅ تراکنش‌های «محاسبات رمزی» — تعریف زودهنگام برای استفاده در balanceOf
  const [ccTransactions, setCcTransactions] = useState<CryptocalcTransaction[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const [openStatementId, setOpenStatementId] = useState<string | null>(null);

  // ✅ اتصال به داده‌های حواله (localStorage/Firestore مشترک با تب حواله)
  // تا صورت‌حساب هر حساب، ستون‌های حواله (مبلغ نهایی، کارمزد، مقصد، وضعیت...) را نشان دهد
  interface LinkedHawala {
    id: string; number: string; trackingCode?: string; date: string; time?: string;
    senderName?: string; receiverName?: string; destinationText?: string; province?: string;
    finalAmount?: number; fee?: number; feePayer?: string; status?: string;
  }
  const [linkedHawalas] = useSafeSyncedState<LinkedHawala>("hawalas", []);
  const hawalaStatusLabelsFa: Record<string, string> = { pending: "در انتظار", sent: "ارسال‌شده", paid: "تصفیه‌شده", cancelled: "لغوشده" };
  const findLinkedHawala = (code: string): LinkedHawala | undefined => {
    const m = matchableCode(code);
    if (!m || m === "X-") return undefined;
    return linkedHawalas.find((h) => matchableCode(h?.trackingCode || h?.number || "") === m);
  };

  // ✅ فرم «محاسبات رمزی»: واریز/برداشت روی secret_accounts/{id}/transactions
  const CURRENCY_OPTIONS: { code: CurrencyCode; name: string }[] = [
    { code: "AFN", name: "افغانی" },
    { code: "USD", name: "دالر" },
    { code: "EUR", name: "یورو" },
    { code: "IRR", name: "تومان" },
    { code: "PKR", name: "کلدار" },
  ];
  const CC_STORAGE_KEY = "cryptocalc_transactions_local_v1";
  // ✅ بدون مقادیر پیش‌فرض — همه فیلدها خالی شروع می‌شوند و کاربر خودش پر می‌کند
  const [ccForm, setCcForm] = useState({
    accountId: "",
    amount: "",
    currency: "" as "" | CurrencyCode,
    dateTimeLocal: "",
    cardReference: "",
  });
  const [ccSaving, setCcSaving] = useState(false);
  const [ccLoaded, setCcLoaded] = useState(false);

  // ✅ فرم برداشت (حالت دوم): انتخاب حساب مبدأ + نام، نام پدر، شماره تلفن، نمبر تذکره — همه بدون پیش‌فرض
  const [wdForm, setWdForm] = useState({
    withdrawAccountId: "",
    recipientName: "",
    fatherName: "",
    phone: "",
    idCard: "",
  });
  // ✅ حالت فعلی فرم: با کلیک روی دکمه برداشت، فیلد ۶ رقم جای خود را به مشخصات برداشت‌کننده می‌دهد
  const [ccMode, setCcMode] = useState<CryptoTxType>("deposit");

  // ✅ Ref و caret برای رفع مشکل «عدد وارد نمی‌شود» — حفظ مکان‌نما بعد از فرمت‌دهی هزارگان
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaret = useRef<number | null>(null);

  // ✅ فیلد ۶ رقم کارت: کنترل مهارتی (uncontrolled) — تایپ با هر کیبوردی آزاد است،
  // مقدار فقط هنگام onBlur/Paste به state منتقل و نرمال‌سازی می‌شود
  const cardInputRef = useRef<HTMLInputElement | null>(null);
  const [ccResetKey, setCcResetKey] = useState(0);
  const commitCardReference = (raw: string) => {
    const clean = normalizeCardRef(raw);
    if (cardInputRef.current && cardInputRef.current.value !== clean) {
      cardInputRef.current.value = clean;
    }
    setCcForm((prev) => (prev.cardReference === clean ? prev : { ...prev, cardReference: clean }));
  };

  // ✅ تاریخ دیگر دستی وارد نمی‌شود: هر تراکنش «خودکار» تاریخ و ساعت همان لحظه ثبت،
  // به وقت افغانستان (کابل، UTC+4:30) و به صورت هجری شمسی دریافت می‌کند.
  // این state فقط برای رندر مجددِ ساعت زنده در بالای فرم استفاده می‌شود.
  const [, setKabulClockTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setKabulClockTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pendingCaret.current != null && amountInputRef.current) {
      const pos = pendingCaret.current;
      amountInputRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  }, [ccForm.amount]);

  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean; type: "account" | "transaction"; id: string; accountId?: string } | null>(null);

  // ✅ منوی عملیات (سه‌نقطه ⋮) در ستون «عملیات» صورت‌حساب هر حساب
  const [openTxActionId, setOpenTxActionId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  // بستن منو با کلیک در خارج از آن (مثل الگوی ActionButtons در HawalaPage)
  useEffect(() => {
    if (!openTxActionId) return;
    const onDocDown = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenTxActionId(null);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [openTxActionId]);

  // ✅ مودال ویرایش تراکنش محاسبات رمزی (مبلغ، نوع، تاریخ/ساعت، شرح)
  const [editTx, setEditTx] = useState<CryptocalcTransaction | null>(null);
  const [editTxFreeDate, setEditTxFreeDate] = useState(false);
  const [editTxForm, setEditTxForm] = useState({ amount: "", type: "deposit" as CryptoTxType, date: "", time: "", note: "" });
  const [editTxSaving, setEditTxSaving] = useState(false);

  useEffect(() => {
    if (!auth) { setAuthReady(true); return; }
    if (auth.currentUser) { setUid(auth.currentUser.uid); setAuthReady(true); return; }
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAccounts(sortDesc(JSON.parse(raw).map(toAccount).filter(Boolean)));
      const rawTx = localStorage.getItem(TX_STORAGE_KEY);
      if (rawTx) setTransactions(JSON.parse(rawTx).map(toTransaction).filter(Boolean));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!db || !uid) return;
    
    const qAccounts = query(collection(db!, "users", uid, "secret_accounts"), orderBy("createdAt", "desc"));
    const qTransactions = query(collection(db!, "users", uid, "secret_transactions"), orderBy("ts", "desc"));

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

  // ✅ بیلانس یکپارچه: تراکنش‌های قدیمی (secret_transactions) + تراکنش‌های «محاسبات رمزی» (subcollection)
  const balanceOf = (accountId: string): number => {
    const oldSum = transactions.filter((t) => t.accountId === String(accountId))
      .reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);
    const ccSum = ccTransactions.filter((t) => t.accountId === String(accountId))
      .reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);
    return oldSum + ccSum;
  };

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
      
      if (!db || !auth.currentUser) {
        showToast("❌ اتصال به دیتابیس برقرار نیست");
        setSaving(false);
        return;
      }
      
      const currentUid = auth.currentUser.uid;
      await setDoc(doc(db!, "users", currentUid, "secret_accounts", newId), {
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
    if (!confirmDialog || !auth?.currentUser || !db) return;
    const { type, id, accountId } = confirmDialog;
    
    try {
      if (type === "account") {
        await deleteDoc(doc(db!, "users", auth.currentUser.uid, "secret_accounts", String(id)));
        const txs = transactions.filter(t => t.accountId === String(id));
        for (const tx of txs) {
          await deleteDoc(doc(db!, "users", auth.currentUser.uid, "secret_transactions", tx.id));
        }
        showToast("🗑️ حساب و سوابق آن حذف شد");
      } else {
        await deleteDoc(doc(db!, "users", auth.currentUser.uid, "secret_transactions", String(id)));
        showToast("🗑️ تراکنش حذف شد");
      }
    } catch (err) {
      console.error("خطا در حذف:", err);
      showToast("❌ خطا در حذف");
    } finally {
      setConfirmDialog(null);
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

  // ============================================================
  // ✅ منطق تب «محاسبات رمزی» — secret_accounts/{accountId}/transactions
  // ============================================================
  const toCcTransaction = (id: string, accountId: string, raw: any): CryptocalcTransaction | null => {
    if (!raw || typeof raw !== "object") return null;
    const amount = Number(raw.amount ?? 0);
    if (!isFinite(amount) || amount <= 0) return null;
    const tsRaw = raw.timestamp;
    let timestampMs = Number(raw.timestampMs ?? 0);
    if (!timestampMs && tsRaw && typeof tsRaw.toMillis === "function") {
      try { timestampMs = tsRaw.toMillis(); } catch {}
    }
    if (!timestampMs) timestampMs = Date.now();
    return {
      id,
      accountId,
      amount,
      currency: (["AFN", "USD", "EUR", "IRR", "PKR"].includes(String(raw.currency)) ? String(raw.currency) : "AFN") as CurrencyCode,
      type: raw.type === "withdrawal" ? "withdrawal" : "deposit",
      cardReference: String(raw.cardReference ?? ""),
      userId: String(raw.userId ?? ""),
      timestampMs,
      shamsiDateTime: String(raw.shamsiDateTime ?? formatShamsiFromLocal(new Date(timestampMs).toISOString().slice(0, 16))),
      // ✅ فیلدهای برداشت (برای تراکنش‌های قدیمی خالی می‌مانند)
      recipientName: String(raw.recipientName ?? ""),
      fatherName: String(raw.fatherName ?? ""),
      phone: String(raw.phone ?? ""),
      idCard: String(raw.idCard ?? ""),
      // ✅ حساب مبدأ برداشت + ارز آن (از Firestore یا localStorage بازیابی شود)
      withdrawAccountId: raw.withdrawAccountId ? String(raw.withdrawAccountId) : undefined,
      withdrawCurrency: (["AFN", "USD", "EUR", "IRR", "PKR"].includes(String(raw.withdrawCurrency)) ? String(raw.withdrawCurrency) : undefined) as CurrencyCode | undefined,
    };
  };

  const refreshCcTransactions = async () => {
    if (!db || !auth?.currentUser) return;
    const uidNow = auth.currentUser.uid;
    try {
      const accSnap = await getDocs(collection(db!, "users", uidNow, "secret_accounts"));
      const all: CryptocalcTransaction[] = [];
      for (const a of accSnap.docs) {
        const txSnap = await getDocs(collection(db!, "users", uidNow, "secret_accounts", a.id, "transactions"));
        txSnap.forEach((t) => {
          const parsed = toCcTransaction(t.id, a.id, t.data());
          if (parsed) all.push(parsed);
        });
      }
      all.sort((x, y) => y.timestampMs - x.timestampMs);
      setCcTransactions(all);
      try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(all)); } catch {}
    } catch (err) {
      console.error("خطا در بارگذاری تراکنش‌های محاسبات رمزی:", err);
    } finally {
      setCcLoaded(true);
    }
  };

  useEffect(() => {
    // بارگذاری کش محلی برای حالت آفلاین
    try {
      const raw = localStorage.getItem(CC_STORAGE_KEY);
      if (raw) setCcTransactions(JSON.parse(raw));
    } catch {}
    if (db && auth?.currentUser) {
      refreshCcTransactions();
    } else {
      setCcLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  /** ثبت واریز/برداشت در subcollection حساب
   *  - واریز (deposit): حساب مقصد + مبلغ + ارز + ۶ رقم کارت/کد پیگیری
   *  - برداشت (withdrawal): ✅ حساب مبدأ (از فیلد «انتخاب حساب برای برداشت») + مبلغ + ارز
   *    + نام برداشت‌کننده + نام پدر + شماره تلفن + نمبر تذکره */
  const submitCcTx = async (type: CryptoTxType) => {
    // ✅ ابتدا مقادیر فیلدها را مستقیم از DOM بخوان —
    // اگر کاربر بدون Leave کردن فیلد دکمه را بزند، onBlur/onInput اجرا نشده و state خالی است
    const cardRefNow = normalizeCardRef(cardInputRef.current?.value ?? ccForm.cardReference);
    if (cardInputRef.current) cardInputRef.current.value = cardRefNow;
    setCcForm((prev) => ({ ...prev, cardReference: cardRefNow }));
    // ✅ مبلغ هم مستقیم از DOM (تبدیل ارقام فارسی به لاتین + حذف جداکننده‌ها)
    const amountRawDom = toLatinDigits(amountInputRef.current?.value ?? ccForm.amount).replace(/[^\d]/g, "");
    setCcForm((prev) => ({ ...prev, amount: amountRawDom ? toFaDigits(Number(amountRawDom).toLocaleString()) : "" }));
    console.log("1. فرم سابمیت شد:", { ...ccForm, amount: amountRawDom, cardReference: cardRefNow, type });

    if (ccSaving) return;
    if (!authReady || !auth?.currentUser || !db) {
      showToast("⚠️ لطفاً ابتدا وارد حساب کاربری خود شوید");
      return;
    }
    // ✅ حساب هدف: برای برداشت = حساب مبدأ (فیلد جدید داخل کادر برداشت)، برای واریز = سلکت بالای فرم
    let targetAccountId = type === "withdrawal" ? wdForm.withdrawAccountId : ccForm.accountId;
    // 🔧 رفع باگ «برداشت کار نمی‌کند»: اگر کاربر در کارت یک حساب روی «🧾 صورت‌حساب» کلیک کرده باشد،
    // همان حساب به‌عنوان پیش‌فرض انتخاب می‌شود تا فقط با زدن دکمه برداشت هم تراکنش ثبت شود
    if (!targetAccountId && openStatementId) {
      const acc = validAccounts.find((a) => String(a.id) === String(openStatementId));
      if (acc) {
        targetAccountId = String(acc.id);
        if (type === "withdrawal") setWdForm((p) => ({ ...p, withdrawAccountId: targetAccountId! }));
        else setCcForm((p) => ({ ...p, accountId: targetAccountId! }));
      }
    }
    if (!targetAccountId) {
      showToast(type === "withdrawal"
        ? "❌ لطفاً حسابی که از آن برداشت می‌شود را انتخاب کنید"
        : "⚠️ لطفاً یک حساب را انتخاب کنید");
      return;
    }
    const numericAmount = Number(amountRawDom);
    if (!isFinite(numericAmount) || numericAmount <= 0) {
      showToast("⚠️ مبلغ باید یک عدد بزرگ‌تر از صفر باشد");
      return;
    }
    if (!ccForm.currency) {
      showToast("⚠️ لطفاً واحد ارز را انتخاب کنید");
      return;
    }

    // ✅ اعتبارسنجی مخصوص هر حالت
    const wdName = wdForm.recipientName.trim();
    const wdFather = wdForm.fatherName.trim();
    const wdPhone = toLatinDigits(wdForm.phone).replace(/[^\d]/g, "");
    const wdIdCard = toLatinDigits(wdForm.idCard).replace(/[^\d]/g, "");
    if (type === "deposit") {
      if (!/^\d{6}$/.test(cardRefNow)) {
        showToast("⚠️ ۶ رقم آخر کارت / کد پیگیری باید دقیقاً ۶ عدد باشد");
        return;
      }
    } else {
      if (!wdName) { showToast("⚠️ لطفاً نام کسی که پول را برداشت می‌کند وارد کنید"); return; }
      if (!wdFather) { showToast("⚠️ لطفاً نام پدر برداشت‌کننده را وارد کنید"); return; }
      if (wdPhone.length < 7) { showToast("⚠️ شماره تلفن معتبر نیست (حداقل ۷ رقم)"); return; }
      if (!wdIdCard) { showToast("⚠️ لطفاً نمبر تذکره برداشت‌کننده را وارد کنید"); return; }
      // بررسی موجودی کافی برای برداشت (از همان حساب مبدأ انتخاب‌شده)
      const accNow = validAccounts.find((a) => String(a.id) === targetAccountId);
      if (accNow) {
        const currentBal = balanceOf(String(accNow.id));
        if (numericAmount > currentBal) {
          showToast(`⚠️ موجودی حساب «${accNow.name}» کافی نیست — موجودی فعلی: ${toFaDigits(currentBal.toLocaleString())}`);
          return;
        }
      }
    }

    const currencyCode = ccForm.currency as CurrencyCode;
    const shamsiStr = formatKabulShamsi();
    // timestamp واقعی (UTC epoch) — نمایش همیشه از رشته شمسی کابل انجام می‌شود
    const txDateMs = Date.now();

    setCcSaving(true);
    const uidNow = auth.currentUser.uid;
    try {
      console.log("2. در حال ذخیره در Firestore...");
      const payload: Record<string, any> = {
        amount: numericAmount,
        currency: currencyCode,
        type,
        timestamp: serverTimestamp(),
        userId: uidNow,
        // فیلدهای کمکی برای نمایش (serverTimestamp تا سینک شدن pending است)
        timestampMs: txDateMs,
        shamsiDateTime: shamsiStr,
      };
      if (type === "deposit") {
        payload.cardReference = cardRefNow;
      } else {
        payload.cardReference = "";
        payload.recipientName = wdName;
        payload.fatherName = wdFather;
        payload.phone = wdPhone;
        payload.idCard = wdIdCard;
      }
      const docRef = await addDoc(
        collection(db!, "users", uidNow, "secret_accounts", targetAccountId, "transactions"),
        payload
      );
      console.log("3. با موفقیت ذخیره شد. ID:", docRef.id);

      const newTx: CryptocalcTransaction = {
        id: docRef.id,
        accountId: targetAccountId,
        amount: numericAmount,
        currency: currencyCode,
        type,
        cardReference: type === "deposit" ? cardRefNow : "",
        userId: uidNow,
        timestampMs: txDateMs,
        shamsiDateTime: shamsiStr,
        recipientName: type === "withdrawal" ? wdName : "",
        fatherName: type === "withdrawal" ? wdFather : "",
        phone: type === "withdrawal" ? wdPhone : "",
        idCard: type === "withdrawal" ? wdIdCard : "",
        withdrawAccountId: type === "withdrawal" ? targetAccountId : undefined,
        withdrawCurrency: type === "withdrawal" ? currencyCode : undefined,
      };
      const nextList = [newTx, ...ccTransactions].sort((a, b) => b.timestampMs - a.timestampMs);
      setCcTransactions(nextList);
      try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(nextList)); } catch {}

      // به‌روزرسانی بیلانس همان حساب هدف (واریز→حساب مقصد / برداشت→حساب مبدأ)
      const acc = validAccounts.find((a) => String(a.id) === targetAccountId);
      if (acc) {
        const delta = type === "deposit" ? numericAmount : -numericAmount;
        const newBalance = balanceOf(String(acc.id)) + delta;
        await setDoc(doc(db!, "users", uidNow, "secret_accounts", String(acc.id)), {
          balance: newBalance,
          updatedAt: Date.now(),
        }, { merge: true });
      }

      showToast(type === "deposit"
        ? `✅ ${toFaDigits(numericAmount.toLocaleString())} ${CURRENCY_NAMES[currencyCode]} واریز شد`
        : `✅ ${toFaDigits(numericAmount.toLocaleString())} ${CURRENCY_NAMES[currencyCode]} به «${wdName}» برداشت شد`);

      // ✅ ریست فرم — همه چیز خالی می‌ماند (بدون پیش‌فرض)، فقط حساب انتخاب‌شده باقی می‌ماند
      setCcForm((prev) => ({ ...prev, amount: "", currency: "", cardReference: "" }));
      setWdForm({ withdrawAccountId: "", recipientName: "", fatherName: "", phone: "", idCard: "" });
      if (cardInputRef.current) cardInputRef.current.value = "";
      setCcResetKey((k) => k + 1); // remount فیلد مهارتی تا واقعاً خالی شود
    } catch (error) {
      console.error("4. خطا:", error);
      showToast("❌ خطا در ذخیره‌سازی تراکنش — اینترنت را بررسی کنید");
    } finally {
      setCcSaving(false);
    }
  };

  // ✅ باز کردن مودال ویرایش یک تراکنش از صورت‌حساب
  const openEditTxModal = (t: CryptocalcTransaction) => {
    setOpenTxActionId(null);
    const dt = new Date(t.timestampMs);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditTx(t);
    setEditTxFreeDate(false);
    setEditTxForm({
      amount: addCommas(String(t.amount || 0)),
      type: t.type === "withdrawal" ? "withdrawal" : "deposit",
      date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
      note: t.recipientName ? `برداشت توسط ${t.recipientName}` : "",
    });
  };

  /** 📤 اشتراک‌گذاری — دقیقاً همان منطق و قالب فاکتوری که در HawalaPage.tsx (تابع shareHawala) استفاده شده:
   *  generateShareText + handleShare (navigator.share در موبایل / navigator.clipboard در دسکتاپ) */
  const shareStatementTx = async (t: CryptocalcTransaction | Transaction, accountId: string) => {
    setOpenTxActionId(null);
    const isCc = !("ts" in t);
    const cc = t as CryptocalcTransaction;
    const legacy = t as Transaction;
    const custName = ccAccountName(accountId);
    const cardCode = isCc ? cc.cardReference : (legacy.cardReference || legacy.cardNumber || legacy.transferNo || "");
    const linkedH = findLinkedHawala(cardCode);
    const curLabel = CURRENCY_NAMES[(isCc ? cc.currency : legacy.currency) as string] ?? String(isCc ? cc.currency : legacy.currency);
    const txType: "deposit" | "withdraw" = t.type === "deposit" ? "deposit" : "withdraw";
    const description = isCc
      ? (cc.type === "withdrawal"
          ? `برداشت نقدی${cc.recipientName ? ` توسط ${cc.recipientName}${cc.fatherName ? ` ولد ${cc.fatherName}` : ""}` : ""}`
          : `واریز${cc.cardReference ? ` (کد ${cc.cardReference})` : ""}`)
      : (legacy.note || (legacy.type === "deposit" ? "واریز" : "برداشت"));
    // 🔴 بیلانس لحظه‌ای مشتری — دقیقاً مثل shareHawala از داده‌های زنده گرفته می‌شود
    const balNow = balanceOf(String(accountId));
    const text = generateShareText(
      {
        trackingCode: cardCode || undefined,
        date: isCc ? cc.shamsiDateTime : `${legacy.date} ${legacy.time || ""}`.trim(),
        customerName: custName,
        senderName: linkedH?.senderName || custName,
        receiverName: linkedH?.receiverName || (isCc ? cc.recipientName || undefined : undefined),
        destinationText: linkedH?.destinationText,
        description,
        amount: Number(t.amount) || 0,
        currencyLabel: curLabel,
      },
      { AFN: txType === "withdraw" ? -balNow : balNow },
      txType === "withdraw" ? "withdraw" : "deposit"
    );
    const res = await handleShare(text);
    if (res === "shared") showToast("📤 سند ارسال شد");
    else if (res === "copied") showToast("📋 متن سند کپی شد");
  };

  // ✅ ذخیره ویرایش تراکنش — موجودی و مانده پس از هر تراکنش خودکار بازمحاسبه می‌شوند
  const saveEditTx = async () => {
    if (!editTx || editTxSaving) return;
    if (!auth?.currentUser || !db) { showToast("❌ اتصال به دیتابیس برقرار نیست"); return; }
    const numericAmount = Number(String(editTxForm.amount).replace(/[^\d]/g, ""));
    if (!isFinite(numericAmount) || numericAmount <= 0) { showToast("⚠️ مبلغ باید یک عدد معتبر باشد"); return; }
    let tsMs = editTx.timestampMs;
    if (editTxFreeDate && editTxForm.date) {
      const d = new Date(`${editTxForm.date}T${editTxForm.time || "00:00"}`);
      if (!isNaN(d.getTime())) tsMs = d.getTime();
    }
    const shamsiStr = editTxFreeDate ? formatShamsiFromLocal(`${editTxForm.date}T${editTxForm.time || "00:00"}`) : editTx.shamsiDateTime;
    const recipientName = editTxForm.note.trim() || editTx.recipientName || "";
    setEditTxSaving(true);
    try {
      await updateDoc(doc(db!, "users", auth.currentUser.uid, "secret_accounts", editTx.accountId, "transactions", editTx.id), {
        amount: numericAmount,
        type: editTxForm.type,
        timestampMs: tsMs,
        shamsiDateTime: shamsiStr,
        recipientName,
        updatedAt: Date.now(),
      });
      const nextList = ccTransactions
        .map((t) => (t.id === editTx.id && t.accountId === editTx.accountId
          ? { ...t, amount: numericAmount, type: editTxForm.type, timestampMs: tsMs, shamsiDateTime: shamsiStr, recipientName }
          : t))
        .sort((a, b) => b.timestampMs - a.timestampMs);
      setCcTransactions(nextList);
      try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(nextList)); } catch {}
      // ✅ اصلاح موجودی حساب مبدأ: حذف اثر تراکنش قدیمی + اعمال اثر جدید
      const accId = String(editTx.accountId);
      const oldEffect = editTx.type === "deposit" ? editTx.amount : -editTx.amount;
      const newEffect = editTxForm.type === "deposit" ? numericAmount : -numericAmount;
      const acc = validAccounts.find((a) => String(a.id) === accId);
      if (acc) {
        const newBalance = balanceOf(accId) - oldEffect + newEffect;
        await setDoc(doc(db!, "users", auth.currentUser.uid, "secret_accounts", accId), {
          balance: newBalance,
          updatedAt: Date.now(),
        }, { merge: true });
      }
      showToast("✅ تراکنش ویرایش شد — موجودی و مانده دوباره محاسبه شد");
      setEditTx(null);
    } catch (err) {
      console.error("خطا در ویرایش تراکنش:", err);
      showToast("❌ خطا در ذخیره ویرایش");
    } finally {
      setEditTxSaving(false);
    }
  };

  const deleteCcTx = async (tx: CryptocalcTransaction) => {
    if (!confirm(`آیا از حذف این تراکنش (${tx.type === "deposit" ? "واریز" : "برداشت"} ${toFaDigits(tx.amount.toLocaleString())}) اطمینان دارید؟`)) return;
    if (!db || !auth?.currentUser) { showToast("❌ اتصال به دیتابیس برقرار نیست"); return; }
    try {
      await deleteDoc(doc(db!, "users", auth.currentUser.uid, "secret_accounts", tx.accountId, "transactions", tx.id));
      const nextList = ccTransactions.filter((t) => !(t.id === tx.id && t.accountId === tx.accountId));
      setCcTransactions(nextList);
      try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(nextList)); } catch {}
      showToast("🗑️ تراکنش حذف شد");
    } catch (err) {
      console.error("خطا در حذف تراکنش:", err);
      showToast("❌ خطا در حذف");
    }
  };

  const ccAccountName = (accountId: string) =>
    validAccounts.find((a) => String(a.id) === accountId)?.name ?? "حساب حذف‌شده";

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

        <div className="sa-up flex items-center gap-2" style={{ animationDelay: "280ms" }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm shadow-md">📒</span>
          <b className="text-sm md:text-base font-black text-slate-800">فهرست حسابات</b>
        </div>

        {/* ============================================================ */}
        {/* ✅ تب محاسبات رمزی — فرم واریز/برداشت + لیست تراکنش‌ها        */}
        {/* ============================================================ */}
        <div className="sa-up relative overflow-hidden rounded-xl md:rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-br from-fuchsia-50 via-white to-purple-50 p-3 md:p-4 shadow-[0_10px_30px_-10px_rgba(192,38,211,0.25)] transition-all duration-300 hover:shadow-xl" style={{ animationDelay: "245ms" }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-500 text-white text-sm shadow-md">🧮</span>
            <b className="text-sm md:text-base font-black text-fuchsia-700">محاسبات رمزی — ثبت واریز و برداشت</b>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fld(ccMode === "withdrawal" ? "حساب مقصد (اختیاری هنگام برداشت)" : "حساب *", (
              <select className={inputCls} value={ccForm.accountId} onChange={(e) => setCcForm({ ...ccForm, accountId: e.target.value })}>
                <option value="">— انتخاب حساب —</option>
                {validAccounts.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {a.name}{a.wald ? ` (${a.wald})` : ""}
                  </option>
                ))}
              </select>
            ), "md:col-span-2")}

            {/* فیلد ۱: مبلغ + واحد ارز */}
            <div>
              <label className={uiLabel}>مبلغ</label>
              <div className="flex gap-2">
                <input
                  ref={amountInputRef}
                  className={`${inputCls} flex-1 font-black text-lg tracking-wider select-text`}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  value={ccForm.amount}
                  onChange={(e) => {
                    const { text, caret } = formatAmountKeepCaret(e.target.value, e.target.selectionStart ?? e.target.value.length);
                    setCcForm((prev) => ({ ...prev, amount: text }));
                    pendingCaret.current = caret;
                  }}
                  placeholder="مبلغ را وارد کنید"
                />
                <select
                  className={`h-12 rounded-xl border bg-slate-50 px-3 text-sm font-bold outline-none focus:border-fuchsia-500 ${ccForm.currency ? "border-slate-200 text-slate-700" : "border-slate-200 text-slate-400"}`}
                  value={ccForm.currency}
                  onChange={(e) => setCcForm({ ...ccForm, currency: e.target.value as CurrencyCode })}
                >
                  <option value="">انتخاب ارز</option>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* فیلد ۲: تاریخ و ساعت — ✅ خودکار، بدون ورود دستی.
                هر تراکنش هنگام ثبت، تاریخ همان روز و ساعت لحظه ثبت را به وقت افغانستان
                (کابل، UTC+4:30) و به صورت هجری شمسی دریافت می‌کند. */}
            <div>
              <label className={uiLabel}>تاریخ و ساعت (هجری شمسی — خودکار)</label>
              <div className={`${inputCls} flex items-center justify-between bg-slate-50 text-slate-600`}>
                <span className="font-black tracking-wider">🗓️ {formatKabulShamsi()}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                تاریخ و ساعت به‌صورت خودکار روی همین لحظه تنظیم می‌شود — نیازی به وارد کردن دستی نیست
              </p>
            </div>

            {/* فیلد ۳ (فقط برای واریز): ۶ رقم آخر کارت — کنترل مهارتی (uncontrolled) برای رفع مشکل «عدد وارد نمی‌شود»
                مقدار در هر لحظه تایپ (onInput) نرمال‌سازی و به state منتقل می‌شود؛
                ارقام فارسی/عربی خودکار به لاتین تبدیل می‌شوند تا دکمه‌ها درست فعال شوند */}
            <div className="md:col-span-2">
              {ccMode === "deposit" ? (
                <>
                  <label className={uiLabel}>۶ رقم آخر کارت / کد پیگیری واریز</label>
                  <input
                    ref={cardInputRef}
                    key={`card-${ccResetKey}`}
                    className={`${inputCls} select-text font-black tracking-[0.3em] text-center ${/^\d{6}$/.test(ccForm.cardReference) ? "border-emerald-400 bg-emerald-50/50" : ""}`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    name="card-reference"
                    defaultValue=""
                    onInput={() => commitCardReference(cardInputRef.current?.value ?? "")}
                    onBlur={() => commitCardReference(cardInputRef.current?.value ?? "")}
                    onPaste={() => {
                      // پس از Paste هم مقدار را نرمال‌سازی و به state منتقل کن
                      setTimeout(() => commitCardReference(cardInputRef.current?.value ?? ""), 0);
                    }}
                    placeholder="کد ۶ رقمی را وارد کنید"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    برای واریزهای شبا/پایا، ۶ رقم آخر کارت یا کد پیگیری را وارد کنید
                  </p>
                </>
              ) : (
                <>
                  {/* ✅ حالت برداشت: انتخاب حساب مبدأ + نام برداشت‌کننده + نام پدر + شماره تلفن + نمبر تذکره (بدون پیش‌فرض) */}
                  <label className={uiLabel}>انتخاب حساب برای برداشت + مشخصات کسی که پول را برداشت می‌کند</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border-2 border-red-200 bg-red-50/40 p-2.5">
                    {/* ✅ فیلد جدید: از کدام حساب پول برداشت شود — با نمایش موجودی هر حساب
                        🔧 هم onChange و هم sync با «حساب مقصد» بالای فرم — اگر سلکت خالی بماند،
                        مقدار انتخاب‌شده به ccForm.accountId هم منتقل می‌شود تا برداشت همیشه حساب داشته باشد */}
                    <select
                      className={`${inputCls} w-full sm:col-span-2 ${wdForm.withdrawAccountId ? "border-red-400 bg-white text-slate-700" : "border-slate-200 bg-white text-slate-400"}`}
                      value={wdForm.withdrawAccountId || ccForm.accountId}
                      onChange={(e) => { setWdForm((p) => ({ ...p, withdrawAccountId: e.target.value })); if (e.target.value) setCcForm((p) => ({ ...p, accountId: e.target.value })); }}
                    >
                      <option value="">🏦 انتخاب حساب برای برداشت</option>
                      {validAccounts.map((a) => {
                        const bal = balanceOf(String(a.id));
                        return (
                          <option key={`wd-${a.id}`} value={String(a.id)} disabled={bal <= 0}>
                            {String(a.name).trim()} — موجودی: {toFaDigits(bal.toLocaleString())}{bal <= 0 ? " (موجودی ناکافی)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <input
                      className={`${inputCls} w-full`}
                      type="text"
                      autoComplete="off"
                      value={wdForm.recipientName}
                      onChange={(e) => setWdForm((p) => ({ ...p, recipientName: e.target.value }))}
                      placeholder="نام برداشت‌کننده"
                    />
                    <input
                      className={`${inputCls} w-full`}
                      type="text"
                      autoComplete="off"
                      value={wdForm.fatherName}
                      onChange={(e) => setWdForm((p) => ({ ...p, fatherName: e.target.value }))}
                      placeholder="نام پدر"
                    />
                    <input
                      className={`${inputCls} w-full select-text`}
                      type="text"
                      inputMode="tel"
                      dir="ltr"
                      autoComplete="off"
                      maxLength={15}
                      value={wdForm.phone}
                      onChange={(e) => {
                        const clean = toLatinDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 15);
                        setWdForm((p) => ({ ...p, phone: clean }));
                      }}
                      placeholder="📞 شماره تلفن"
                    />
                    <input
                      className={`${inputCls} w-full select-text`}
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      autoComplete="off"
                      maxLength={16}
                      value={wdForm.idCard}
                      onChange={(e) => {
                        const clean = toLatinDigits(e.target.value).replace(/[^\d]/g, "").slice(0, 16);
                        setWdForm((p) => ({ ...p, idCard: clean }));
                      }}
                      placeholder="🪪 نمبر تذکره"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    هنگام برداشت، مشخصات کامل فرد برداشت‌کننده ثبت می‌شود — کد ۶ رقمی فقط برای واریز لازم است
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {/* ✅ دکمه‌ها همیشه فعال‌اند (بدون disabled) — اگر فیلدی ناقص باشد
                خود submitCcTx پیام راهنمای دقیق نشان می‌دهد. این کار مشکل
                «دکمه کار نمی‌کند» را حتی در صورت خالی ماندن state فیلد مهارتی حل می‌کند،
                چون مقدار کارت مستقیم از DOM خوانده می‌شود. */}
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()} // حفظ فوکوس و مقدار فیلدها هنگام لمس موبایل
              onClick={() => { setCcMode("deposit"); submitCcTx("deposit"); }}
              className={`flex-1 cursor-pointer rounded-xl px-6 py-3 text-sm font-black text-white transition-all active:scale-95 flex items-center justify-center gap-2 ${
                ccMode === "deposit"
                  ? "bg-gradient-to-l from-green-600 to-emerald-600 hover:brightness-110 shadow-lg shadow-green-500/25 ring-2 ring-emerald-400"
                  : "bg-gradient-to-l from-green-700/70 to-emerald-700/70 hover:brightness-110 shadow-md"
              }`}
            >
              <span>⬇️</span> {ccSaving && ccMode === "deposit" ? "در حال ثبت…" : "واریز"}
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => { setCcMode("withdrawal"); submitCcTx("withdrawal"); }}
              className={`flex-1 cursor-pointer rounded-xl px-6 py-3 text-sm font-black text-white transition-all active:scale-95 flex items-center justify-center gap-2 ${
                ccMode === "withdrawal"
                  ? "bg-gradient-to-l from-red-600 to-rose-600 hover:brightness-110 shadow-lg shadow-red-500/25 ring-2 ring-red-400"
                  : "bg-gradient-to-l from-red-700/70 to-rose-700/70 hover:brightness-110 shadow-md"
              }`}
            >
              <span>⬆️</span> {ccSaving && ccMode === "withdrawal" ? "در حال ثبت…" : "برداشت"}
            </button>
          </div>

          {/* لیست تراکنش‌های محاسبات رمزی */}
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-black text-fuchsia-700">🧾 لیست تراکنش‌ها ({ccTransactions.length})</h4>
            {!ccLoaded ? (
              <p className="text-xs font-bold text-slate-500 py-3 text-center">در حال بارگذاری…</p>
            ) : ccTransactions.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-fuchsia-200 bg-white/70 p-4 text-center text-xs font-bold text-slate-500">
                هنوز تراکنشی در محاسبات رمزی ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                {ccTransactions.map((t) => (
                  <div key={`${t.accountId}_${t.id}`} className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs shadow-sm space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`rounded-md px-2 py-0.5 font-black ${t.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                          {t.type === "deposit" ? "🟢 واریز" : "🔴 برداشت"}
                        </span>
                        <span className="text-slate-800 font-black tabular-nums" dir="ltr">
                          {toFaDigits(t.amount.toLocaleString("en-US"))} {CURRENCY_NAMES[t.currency] ?? t.currency}
                        </span>
                        <span className="rounded-md bg-fuchsia-50 px-2 py-0.5 font-bold text-fuchsia-700 truncate max-w-[120px]">
                          👤 {ccAccountName(t.accountId)}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteCcTx(t)}
                        className="cursor-pointer text-[11px] rounded-md bg-red-50 hover:bg-red-100 text-red-600 font-bold px-2 py-1 transition-colors"
                      >
                        🗑 حذف
                      </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-slate-500 font-bold">
                      <span>📅 {t.shamsiDateTime}</span>
                      {t.cardReference && (
                        <span className="rounded-md bg-sky-50 px-2 py-0.5 font-black text-sky-700" dir="ltr">💳 {toFaDigits(t.cardReference)}</span>
                      )}
                      {/* ✅ حساب مبدأ برداشت در لیست تراکنش‌ها */}
                      {t.type === "withdrawal" && t.withdrawAccountId && (
                        <span className="rounded-md bg-rose-50 px-2 py-0.5 font-bold text-rose-700 truncate max-w-[140px]">
                          🏦 از حساب: {ccAccountName(t.withdrawAccountId)}
                        </span>
                      )}
                      {/* ✅ مشخصات برداشت‌کننده در تراکنش‌های برداشت */}
                      {t.type === "withdrawal" && t.recipientName && (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 font-black text-red-700">🧑‍💼 {t.recipientName}{t.fatherName ? ` بنده ${t.fatherName}` : ""}</span>
                      )}
                      {t.type === "withdrawal" && t.phone && (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-700" dir="ltr">📞 {toFaDigits(t.phone)}</span>
                      )}
                      {t.type === "withdrawal" && t.idCard && (
                        <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700" dir="ltr">🪪 {toFaDigits(t.idCard)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              // ✅ صورت‌حساب: تراکنش‌های «محاسبات رمزی» (واریز و برداشت) هم نمایش داده می‌شوند
              const ccAccTx = ccTransactions.filter((t) => String(t.accountId) === key)
                .sort((a, b) => b.timestampMs - a.timestampMs);
              const txTime = (t: Transaction | CryptocalcTransaction) =>
                "ts" in t ? (t as Transaction).ts : (t as CryptocalcTransaction).timestampMs;
              const allStatementTx = [...accTx, ...ccAccTx].sort((a, b) => txTime(b) - txTime(a));
              const statementCount = accTx.length + ccAccTx.length;
              const liveBalance = balanceOf(key);
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
                    <button onClick={() => setOpenStatementId(isOpen ? null : key)} className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-violet-600 to-indigo-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-violet-500/20 transition-all">🧾 صورت‌حساب ({statementCount})</button>
                    <button onClick={() => handleDeleteRequest("account", key)} className="cursor-pointer text-xs rounded-lg bg-gradient-to-l from-red-600 to-rose-600 hover:brightness-110 active:scale-95 px-3.5 py-2 font-black text-white shadow-md shadow-red-500/20 transition-all">🗑 حذف</button>
                  </div>

                  {isOpen && (
                    /* ✅ صورت‌حساب با ستون‌های استاندارد (نسخه فشرده):
                       شماره | تاریخ | حواله‌گیرنده | مبلغ نهایی | کارمزد | وضعیت | عملیات */
                    <div className="mt-1 rounded-lg border border-violet-100 bg-violet-50/40 p-2 space-y-1">
                      {/* ✅ هدر اضافی صورت‌حساب حذف شد: تعداد تراکنش، مجموع ورودی و خروجی نمایش داده نمی‌شود */}

                      {allStatementTx.length === 0 ? (
                        <p className="text-[11px] font-bold text-slate-400 text-center py-1">تراکنشی ثبت نشده است.</p>
                      ) : (
                        <div className="max-h-80 overflow-auto rounded-md bg-white border border-violet-100">
                          <table className="w-full table-fixed text-right border-collapse">
                            <colgroup>
                              <col style={{ width: "8%" }} />
                              <col style={{ width: "17%" }} />
                              <col style={{ width: "17%" }} />
                              <col style={{ width: "16%" }} />
                              <col style={{ width: "14%" }} />
                              <col style={{ width: "15%" }} />
                              <col style={{ width: "13%" }} />
                            </colgroup>
                            <thead className="sticky top-0 z-10 bg-violet-50">
                              <tr className="text-[10px] font-black text-slate-500">
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">شماره</th>
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">تاریخ</th>
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">حواله‌گیرنده</th>
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">مبلغ نهایی</th>
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">کارمزد</th>
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">وضعیت</th>
                                <th className="px-2 py-2 text-center whitespace-nowrap border-b border-violet-100">عملیات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-violet-50">
                              {allStatementTx.map((t, idx) => {
                                const isCc = !("ts" in t);
                                const cc = t as CryptocalcTransaction;
                                const legacy = t as Transaction;
                                const displayCard = isCc ? cc.cardReference : (legacy.cardReference || legacy.cardNumber || legacy.transferNo || "");
                                const displayDate = isCc ? (cc.shamsiDateTime || "") : `${legacy.date}${legacy.time ? ` ${legacy.time}` : ""}`;
                                const txCurName = isCc ? (CURRENCY_NAMES[cc.currency] ?? cc.currency) : curName;
                                // ✅ اتصال به تب حواله: اگر کد پیگیری با یک حواله مطابق شد، ستون‌های حواله از آن خوانده می‌شود
                                const linkedH = findLinkedHawala(displayCard);
                                const receiverCell = linkedH?.receiverName || (isCc && t.type === "withdrawal" ? (cc.recipientName || "—") : (isCc ? "—" : (legacy.note || "—")));
                                const finalAmtCell = addCommas(String(linkedH?.finalAmount ?? t.amount));
                                const feeVal = linkedH ? Number(linkedH.fee || 0) : 0;
                                const feeCell = feeVal > 0 ? `${addCommas(String(feeVal))} ${txCurName}` : `0 ${txCurName}`;
                                const statusCell = linkedH ? (hawalaStatusLabelsFa[linkedH.status || ""] || linkedH.status || "—") : (t.type === "deposit" ? "واریز" : "برداشت");
                                const statusCls = linkedH
                                  ? (linkedH.status === "paid" ? "bg-emerald-50 text-emerald-700" : linkedH.status === "sent" ? "bg-sky-50 text-sky-700" : linkedH.status === "cancelled" ? "bg-red-50 text-red-600 line-through" : "bg-amber-50 text-amber-700")
                                  : (t.type === "deposit" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600");
                                return (
                                  <tr key={t.id} className="hover:bg-violet-50/50 transition-colors">
                                    <td className="px-2 py-1.5 text-center text-[11px] font-black text-slate-500">{idx + 1}</td>
                                    <td className="px-2 py-1.5 text-center text-[11px] font-bold text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis" dir="ltr">{displayDate || "—"}</td>
                                    <td className="px-2 py-1.5 text-center text-[11px] font-bold text-sky-700 overflow-hidden text-ellipsis whitespace-nowrap" title={receiverCell}>{receiverCell}</td>
                                    <td className={`px-2 py-1.5 text-center whitespace-nowrap ${t.type === "deposit" ? "text-emerald-600" : "text-red-500"}`}>
                                      <span className="block text-[11px] font-black tabular-nums" dir="ltr">{finalAmtCell}</span>
                                      <span className="block text-[9px] font-bold text-slate-400">{txCurName}</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-[10px] font-bold text-purple-700 whitespace-nowrap overflow-hidden text-ellipsis">{feeCell}</td>
                                    <td className="px-2 py-1.5 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${statusCls}`}>{statusCell}</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                                      {/* ✅ ستون عملیات: آیکون سه‌نقطه ⋮ با منوی کشویی (حذف / ویرایش / اشتراک‌گذاری) — الگو از ActionButtons در HawalaPage */}
                                      <div ref={openTxActionId === t.id ? actionMenuRef : undefined} className="relative inline-block">
                                        <button
                                          onClick={() => setOpenTxActionId(openTxActionId === t.id ? null : t.id)}
                                          className="cursor-pointer grid h-6 w-6 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                                          title="عملیات"
                                          aria-label="عملیات"
                                        >
                                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
                                        </button>
                                        {openTxActionId === t.id && (
                                          <div dir="rtl" className="absolute left-0 top-7 z-30 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
                                            {isCc ? (
                                              <button onClick={() => openEditTxModal(cc)} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-right text-xs font-black text-slate-700 hover:bg-sky-50 transition-colors">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-sky-600"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                ✏️ ویرایش
                                              </button>
                                            ) : (
                                              <div className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-xs font-black text-slate-300 cursor-not-allowed">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                                ✏️ ویرایش (فقط محاسبات رمزی)
                                              </div>
                                            )}
                                            <button onClick={() => shareStatementTx(t, key)} className="flex w-full cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-right text-xs font-black text-slate-700 hover:bg-emerald-50 transition-colors">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-600"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                                              📤 اشتراک‌گذاری
                                            </button>
                                            <button onClick={() => { setOpenTxActionId(null); if (isCc) deleteCcTx(cc); else handleDeleteRequest("transaction", t.id, key); }} className="flex w-full cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-right text-xs font-black text-red-600 hover:bg-red-50 transition-colors">
                                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                              🗑️ حذف
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ✅ مودال ویرایش تراکنش محاسبات رمزی — مبلغ، نوع، تاریخ/ساعت، شرح
            پس از ذخیره، موجودی حساب و مانده پس از هر تراکنش خودکار بازمحاسبه می‌شود
            🔧 Portal به <body>: قبلاً داخل جدول scroll-shونده رندر می‌شد و fixed نسبت به
            همان کانتینر اعمال شده و مودال به بالای صفحه می‌رفت (غیرقابل استفاده) */}
        {editTx && createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !editTxSaving && setEditTx(null)}>
            <div dir="rtl" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">✏️ ویرایش تراکنش</h3>
                <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-[11px] font-black text-fuchsia-700">👤 {ccAccountName(editTx.accountId)}</span>
              </div>

              {fld("مبلغ", (
                <input
                  value={editTxForm.amount}
                  onChange={(e) => setEditTxForm((f) => ({ ...f, amount: addCommas(e.target.value.replace(/[^\d.,]/g, "")) }))}
                  inputMode="numeric"
                  dir="ltr"
                  className={inputCls + " tabular-nums text-left"}
                  placeholder="مثلاً 25,000"
                />
              ))}

              <div className="grid grid-cols-2 gap-3">
                {fld("نوع تراکنش", (
                  <select
                    value={editTxForm.type}
                    onChange={(e) => setEditTxForm((f) => ({ ...f, type: e.target.value as CryptoTxType }))}
                    className={inputCls}
                  >
                    <option value="deposit">🟢 واریز</option>
                    <option value="withdrawal">🔴 برداشت</option>
                  </select>
                ))}
                <label className="flex items-end gap-2 pb-3 text-xs font-black text-slate-600 cursor-pointer select-none">
                  <input type="checkbox" checked={editTxFreeDate} onChange={(e) => setEditTxFreeDate(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                  تغییر تاریخ و ساعت
                </label>
              </div>

              {editTxFreeDate && (
                <div className="grid grid-cols-2 gap-3">
                  {fld("تاریخ (میلادی)", <input type="date" value={editTxForm.date} onChange={(e) => setEditTxForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} dir="ltr" />)}
                  {fld("ساعت", <input type="time" value={editTxForm.time} onChange={(e) => setEditTxForm((f) => ({ ...f, time: e.target.value }))} className={inputCls} dir="ltr" />)}
                </div>
              )}

              {fld("شرح / نام برداشت‌کننده", (
                <input value={editTxForm.note} onChange={(e) => setEditTxForm((f) => ({ ...f, note: e.target.value }))} className={inputCls} placeholder="اختیاری" />
              ))}

              <p className="rounded-xl bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700 leading-5">
                ℹ️ پس از ذخیره، موجودی حساب و «مانده پس از تراکنش» تمام ردیف‌ها به‌صورت خودکار دوباره محاسبه می‌شود.
              </p>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditTx(null)} disabled={editTxSaving} className="flex-1 cursor-pointer rounded-xl bg-slate-100 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 disabled:opacity-50">انصراف</button>
                <button onClick={saveEditTx} disabled={editTxSaving} className="flex-1 cursor-pointer rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 hover:brightness-110 disabled:opacity-50">{editTxSaving ? "در حال ذخیره…" : "💾 ذخیره تغییرات"}</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900 border border-slate-700 px-5 py-3 text-sm font-bold text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            {toast}
          </div>
        )}

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
