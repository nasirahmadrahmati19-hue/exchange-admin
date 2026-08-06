"use client";

// =================================================================
// 📦 IMPORTS
// =================================================================
import { useState, useEffect } from "react";
import { useStored, Field, SelectField, ErrorBox, Modal, ShareBar } from "./lib/ui";
import {
  loadRates, loadSiteName, loadJSON, fa, todayFa, nowTime, nextReceiptNo,
  CURRENCY_META, applyTransfer, applyExchange, buildReceipt, toAFNk, fromAFNk,
  statusChipClass, checkRequired, requiredMessage, CURRENCIES, CITIES, toAFN, fromAFN,
} from "./lib/helpers";
import { sendTelegram, getLastChatId, getTelegramUsers, getBotInfo } from "./lib/telegram";
import type { AccountUser, CurKey, Tx } from "./lib/helpers";

// =================================================================
// 🎯 TYPES
// =================================================================
interface Hawala {
  id: number; sender: string; receiver: string; phone: string;
  fromCity: string; toCity: string; payCur: string; getCur: string;
  amount: string; result: string; fee: string; date: string; status: string;
}
interface Ticket { id: number; user: string; subject: string; date: string; status: string; reply: string; }
interface TelegramUser { id: number; firstName: string; lastName?: string; username?: string; lastSeen: string; }
const curOptions: CurKey[] = ["AFN", "USD", "IRR"];
const emptyUserForm = { name: "", phone: "", telegram: "", AFN: "", USD: "", IRR: "" };
const emptyHawalaForm = { sender: "", receiver: "", phone: "", fromCity: "هرات", toCity: "مشهد", payCur: "افغانی", getCur: "تومان", amount: "", fee: "0" };

// =================================================================
// 🧩 کامپوننت‌های مشترک (برای کاهش کد تکراری)
// =================================================================

// جدول با ستون شماره (استفاده در حواله، تبادل، مشتریان)
function DataTable({ headers, children, emptyText, colSpan }: {
  headers: string[]; children: React.ReactNode; emptyText: string; colSpan: number;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#0b1f2e] text-[#e3b45c]">
          <tr>
            <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
            {headers.map((h, i) => (
              <th key={i} className="text-right px-4 py-3 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {children}
          {children === null && (
            <tr><td colSpan={colSpan} className="text-center py-8 text-slate-400">{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// شماره ردیف با عدد انگلیسی
function RowNumber({ index }: { index: number }) {
  return (
    <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
      {(index + 1).toLocaleString("en-US")}
    </td>
  );
}

// کارت آمار با گرادیان
function GradientCard({ title, value, subtitle, color, icon }: {
  title: string; value: string; subtitle?: string; color: string; icon?: string;
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${color} p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold opacity-90">{icon} {title}</span>
      </div>
      <p className="text-2xl font-extrabold mt-3">{value}</p>
      {subtitle && <p className="text-[11px] opacity-80 mt-1">{subtitle}</p>}
    </div>
  );
}

// بخش Accordion برای تنظیمات
function AccordionSection({ icon, title, subtitle, isOpen, onToggle, children, accent }: {
  icon: string; title: string; subtitle?: string; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className={`card overflow-hidden ${accent || ""}`}>
      <button onClick={onToggle} className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-slate-400 to-slate-600 rounded-xl flex items-center justify-center text-xl">{icon}</div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-[#0b1f2e]">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>
        <div className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</div>
      </button>
      {isOpen && <div className="p-5 pt-0 space-y-4 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// =================================================================
// 📊 TAB 1: DASHBOARD
// =================================================================
function DashboardTab() {
  const [d, setD] = useState<any>({
    hawalaCount: 0, hawalaVolume: 0, tradeCount: 0, tradeVolume: 0,
    totalFee: 0, tradeProfit: 0, pending: 0, today: 0,
    cur: { "افغانی": 0, "دلار": 0, "تومان": 0, "یورو": 0 },
    accounts: { AFN: 0, USD: 0, IRR: 0 },
    rates: { usd: "70.5", eur: "76", toman: "0.64" },
    commission: "0.5", latest: [],
  });

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("db_hawala") || "[]");
      const t = JSON.parse(localStorage.getItem("db_trades") || "[]");
      const u = JSON.parse(localStorage.getItem("db_users") || "[]");
      let rates = { usd: "70.5", eur: "76", toman: "0.64" };
      const r = localStorage.getItem("db_rates");
      if (r) rates = { ...rates, ...JSON.parse(r) };
      let commission = "0.5";
      const s = localStorage.getItem("db_settings");
      if (s) { const p = JSON.parse(s); if (p?.commission) commission = p.commission; }

      const toAFNLocal = (amount: number, cur: string) => {
        if (cur === "تومان") return (amount / 1000) * Number(rates.toman);
        if (cur === "دلار" || cur === "دالر") return amount * Number(rates.usd);
        if (cur === "یورو") return amount * Number(rates.eur);
        return amount;
      };

      const acc = { AFN: 0, USD: 0, IRR: 0 };
      u.forEach((x: any) => {
        const b = x.balances || { AFN: Number(x.balance || 0), USD: 0, IRR: 0 };
        acc.AFN += b.AFN || 0; acc.USD += b.USD || 0; acc.IRR += b.IRR || 0;
      });

      const curSum: Record<string, number> = { "افغانی": 0, "دلار": 0, "تومان": 0, "یورو": 0 };
      let hawalaVolume = 0, totalFee = 0, pending = 0, today = 0;
      const todayStr = new Date().toLocaleDateString("fa-IR");

      h.forEach((x: any) => {
        hawalaVolume += toAFNLocal(Number(x.amount || 0), x.payCur);
        totalFee += Number(x.fee || 0);
        if (curSum[x.payCur] !== undefined) curSum[x.payCur] += Number(x.amount || 0);
        if (curSum[x.getCur] !== undefined) curSum[x.getCur] += Number(x.result || 0);
        if (x.status === "در انتظار") pending++;
        if (x.date === todayStr) today++;
      });

      let tradeVolume = 0, tradeProfit = 0;
      t.forEach((x: any) => {
        const v = Number(x.afnValue || 0);
        tradeVolume += v;
        tradeProfit += v * (Number(commission) / 100);
        if (curSum[x.currency] !== undefined) curSum[x.currency] += Number(x.amount || 0);
      });

      setD({ hawalaCount: h.length, hawalaVolume, tradeCount: t.length, tradeVolume, totalFee, tradeProfit, pending, today, cur: curSum, accounts: acc, rates, commission, latest: h.slice(0, 4) });
    } catch { }
  }, []);

  const faNum = (n: number) => n.toLocaleString("fa-IR", { maximumFractionDigits: 0 });

  const summary = [
    { t: "مجموع حواله‌جات", v: faNum(d.hawalaCount) + " حواله", sub: "حجم: " + faNum(d.hawalaVolume) + " افغانی" },
    { t: "مجموع تبادل ارز", v: faNum(d.tradeCount) + " معامله", sub: "حجم: " + faNum(d.tradeVolume) + " افغانی" },
    { t: "مجموع کمیشن‌ها", v: faNum(d.totalFee) + " افغانی", sub: "از حواله‌جات" },
    { t: "مفاد از تبادل ارز", v: faNum(d.tradeProfit) + " افغانی", sub: "کارمزد " + d.commission + "٪" },
  ];

  return (
    <div className="space-y-8">
      {/* بنر */}
      <div className="rounded-2xl bg-gradient-to-l from-[#0b1f2e] to-[#16374d] text-white p-6">
        <p className="text-[#e3b45c] text-sm font-bold">صرافی و حواله‌جات برادران نورزاد</p>
        <h2 className="text-xl font-extrabold mt-1">هرات، افغانستان</h2>
        <div className="flex flex-wrap gap-3 mt-4 text-sm">
          <span className="bg-white/10 rounded-xl px-4 py-2">دلار: <b className="text-[#e3b45c]">{d.rates.usd}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">۱۰۰ تومان: <b className="text-[#e3b45c]">{d.rates.toman}</b> افغانی</span>
          <span className="bg-white/10 rounded-xl px-4 py-2">یورو: <b className="text-[#e3b45c]">{d.rates.eur}</b> افغانی</span>
        </div>
      </div>

      {/* مانده کل */}
      <div>
        <h3 className="font-extrabold mb-4">مانده کل حساب‌های مشتریان</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <GradientCard title="افغانی" icon="🇦🇫" value={faNum(d.accounts.AFN)} subtitle="مجموع مانده همه مشتریان" color="from-emerald-500 to-teal-600" />
          <GradientCard title="دالر" icon="🇺🇸" value={faNum(d.accounts.USD)} subtitle="مجموع مانده همه مشتریان" color="from-blue-500 to-indigo-600" />
          <GradientCard title="تومان" icon="🇮🇷" value={faNum(d.accounts.IRR)} subtitle="مجموع مانده همه مشتریان" color="from-amber-500 to-orange-600" />
        </div>
      </div>

      {/* خلاصه */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summary.map(s => (
          <div key={s.t} className="card p-5">
            <p className="text-slate-500 text-xs mb-2">{s.t}</p>
            <p className="text-xl font-extrabold text-[#0b1f2e]">{s.v}</p>
            <p className="text-xs text-[#c98f2d] font-bold mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* گردش ارز */}
      <div>
        <h3 className="font-extrabold mb-4">مجموع گردش به تفکیک ارز</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <GradientCard title="افغانی" value={faNum(d.cur["افغانی"] || 0)} subtitle="مجموع حواله + تبادل" color="from-emerald-500 to-teal-600" />
          <GradientCard title="دلار" value={faNum(d.cur["دلار"] || 0)} subtitle="مجموع حواله + تبادل" color="from-blue-500 to-indigo-600" />
          <GradientCard title="تومان" value={faNum(d.cur["تومان"] || 0)} subtitle="مجموع حواله + تبادل" color="from-amber-500 to-orange-600" />
          <GradientCard title="یورو" value={faNum(d.cur["یورو"] || 0)} subtitle="مجموع حواله + تبادل" color="from-purple-500 to-fuchsia-600" />
        </div>
      </div>

      {/* وضعیت امروز + آخرین حواله‌ها */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="font-extrabold mb-6">وضعیت امروز</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
              <span className="text-sm font-bold text-amber-700">حواله‌های امروز</span>
              <span className="text-xl font-extrabold text-amber-700">{faNum(d.today)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
              <span className="text-sm font-bold text-blue-700">در انتظار ارسال</span>
              <span className="text-xl font-extrabold text-blue-700">{faNum(d.pending)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-sm font-bold text-emerald-700">مجموع مفاد و کمیشن</span>
              <span className="text-xl font-extrabold text-emerald-700">{faNum(d.totalFee + d.tradeProfit)}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="font-extrabold mb-6">آخرین حواله‌ها</h3>
          {d.latest.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">هنوز حواله‌ای ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {d.latest.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-bold text-sm">
                      {h.sender ? h.sender.charAt(0) : "-"}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{h.sender} ← {h.receiver}</p>
                      <p className="text-xs text-slate-500">{h.fromCity} به {h.toCity}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-[#c98f2d]">{Number(h.result).toLocaleString("fa-IR")} {h.getCur}</p>
                    <p className="text-xs text-slate-500">{h.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 💸 TAB 2: HAWALA
// =================================================================
function HawalaTab() {
  const [list, setList] = useStored<Hawala[]>("db_hawala", []);
  const [rates] = useState(loadRates());
  const [form, setForm] = useState(emptyHawalaForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };
  const result = fromAFN(Math.max(toAFN(Number(form.amount || 0), form.payCur, rates) - Number(form.fee || 0), 0), form.getCur, rates);

  const add = () => {
    const m = checkRequired(form, [
      { key: "sender", label: "نام فرستنده" },
      { key: "receiver", label: "نام گیرنده" },
      { key: "amount", label: "مبلغ" },
    ]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    setList([{ id: Date.now(), ...form, result: result.toFixed(0), date: todayFa(), status: "در انتظار" }, ...list]);
    setForm({ ...emptyHawalaForm });
  };

  const wa = (h: Hawala) => {
    const msg = encodeURIComponent(`صرافی برادران نورزاد هرات\nحواله از ${h.fromCity} به ${h.toCity}\nگیرنده: ${h.receiver}\nمبلغ قابل دریافت: ${fa(Number(h.result))} ${h.getCur}\nفرستنده: ${h.sender}`);
    return `https://wa.me/${h.phone}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت حواله جدید</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="نام فرستنده" name="نام فرستنده" missing={missing} value={form.sender} onChange={v => set({ sender: v })} placeholder="مثال: احمد ولی" />
        <Field label="نام گیرنده" name="نام گیرنده" missing={missing} value={form.receiver} onChange={v => set({ receiver: v })} placeholder="مثال: کریم الله" />
        <Field label="شماره واتساپ گیرنده" value={form.phone} onChange={v => set({ phone: v })} placeholder="93... یا 989..." />
        <Field label="مبلغ" name="مبلغ" missing={missing} value={form.amount} onChange={v => set({ amount: v })} placeholder="مبلغ پرداختی" />
        <SelectField label="شهر مبدأ" value={form.fromCity} onChange={v => set({ fromCity: v })} options={CITIES} />
        <SelectField label="شهر مقصد" value={form.toCity} onChange={v => set({ toCity: v })} options={CITIES} />
        <SelectField label="ارز پرداخت" value={form.payCur} onChange={v => set({ payCur: v })} options={CURRENCIES} />
        <SelectField label="ارز دریافت" value={form.getCur} onChange={v => set({ getCur: v })} options={CURRENCIES} />
        <Field label="کارمزد (افغانی)" value={form.fee} onChange={v => set({ fee: v })} placeholder="0" />
        <div className="sm:col-span-2">
          <label className="block text-sm font-bold mb-2 invisible">-</label>
          <div className="flex items-center justify-between bg-[#0b1f2e] rounded-xl px-4 py-2.5">
            <span className="text-[#e3b45c] text-sm font-bold">قابل دریافت:</span>
            <span className="text-white font-extrabold">{fa(result)} {form.getCur}</span>
          </div>
        </div>
        <div className="flex items-end">
          <button className="btn-gold w-full" onClick={add}>ثبت حواله</button>
        </div>
        <div className="lg:col-span-4"><ErrorBox error={error} /></div>
      </div>

      <h1 className="text-xl font-extrabold pt-4">لیست حواله‌ها</h1>
      <DataTable headers={["فرستنده", "گیرنده", "مسیر", "دریافتی", "وضعیت", "عملیات"]} emptyText="هنوز حواله‌ای ثبت نشده" colSpan={7}>
        {list.length === 0 ? null : list.map((h, index) => (
          <tr key={h.id} className="hover:bg-amber-50/40">
            <RowNumber index={index} />
            <td className="px-4 py-3 font-bold">{h.sender}</td>
            <td className="px-4 py-3">{h.receiver}</td>
            <td className="px-4 py-3 text-slate-500 text-xs">{h.fromCity} ← {h.toCity}</td>
            <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(h.result))} {h.getCur}</td>
            <td className="px-4 py-3">
              <select className={`text-xs px-2 py-1.5 rounded-full border ${statusChipClass(h.status)}`} value={h.status} onChange={e => setList(list.map(x => x.id === h.id ? { ...x, status: e.target.value } : x))}>
                <option>در انتظار</option><option>ارسال شده</option><option>تحویل شده</option>
              </select>
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <a href={wa(h)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold">واتساپ</a>
                <button className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold" onClick={() => setList(list.filter(x => x.id !== h.id))}>حذف</button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

// =================================================================
// 💱 TAB 3: TRADES
// =================================================================
function TradesTab() {
  const [users, setUsers] = useStored<AccountUser[]>("db_users", [
    { id: 1, name: "احمد", phone: "93700000000", telegram: "", balances: { AFN: 300000, USD: 1200, IRR: 85000000 }, status: "فعال" },
  ] as any);
  const [trades, setTrades] = useStored<Tx[]>("db_trades", []);
  const [rates] = useState(loadRates());
  const [customerId, setCustomerId] = useState("");
  const [mode, setMode] = useState("انتقال");
  const [cur, setCur] = useState<CurKey>("AFN");
  const [fromCur, setFromCur] = useState<CurKey>("AFN");
  const [toCur, setToCur] = useState<CurKey>("IRR");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [lastTx, setLastTx] = useState<Tx | null>(null);
  const [sendingTg, setSendingTg] = useState(false);
  const [tgStatus, setTgStatus] = useState("");
  const [internalReceiverId, setInternalReceiverId] = useState("");

  const user = users.find(u => u.id === Number(customerId)) as any;
  const amt = Number(amount || 0);
  const exchTo = fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates);
  const clear = () => { setError(""); setTgStatus(""); };

  // تابع مشترک ارسال تلگرام
  const sendTg = async (chatId: string, text: string, silent: boolean) => {
    try {
      const settings = loadJSON<any>("db_settings", {});
      const token = (settings.telegramToken || "").trim();
      if (!token || !chatId) return false;
      return await sendTelegram(token, chatId, text, { silent });
    } catch { return false; }
  };

  const submit = async () => {
    try {
      const settings = loadJSON<any>("db_settings", {});
      const silent = settings.telegramSilent === true;

      // ========== حالت حساب به حساب ==========
      if (mode === "حساب به حساب") {
        if (!customerId || !internalReceiverId || !amount.trim() || amt <= 0) {
          setError("لطفاً فرستنده، گیرنده و مبلغ را وارد کنید"); return;
        }
        if (!user) { setError("فرستنده پیدا نشد"); return; }
        const receiverUser = users.find(u => u.id === Number(internalReceiverId)) as any;
        if (!receiverUser) { setError("گیرنده پیدا نشد"); return; }
        if (user.id === receiverUser.id) { setError("فرستنده و گیرنده نمی‌توانند یک نفر باشند"); return; }
        if ((user.balances[fromCur] || 0) < amt) {
          setError(`موجودی کافی نیست. مانده ${CURRENCY_META[fromCur].label}: ${fa(user.balances[fromCur] || 0)}`); return;
        }

        const senderUpdated = applyTransfer(user, fromCur, amt);
        const receiverAmount = fromCur === toCur ? amt : fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates);
        const receiverUpdated = { ...receiverUser, balances: { ...receiverUser.balances, [toCur]: (receiverUser.balances[toCur] || 0) + receiverAmount } };

        setUsers(users.map(u => u.id === user.id ? senderUpdated : u.id === receiverUser.id ? receiverUpdated : u));

        const receiptNo = nextReceiptNo();
        const date = todayFa(), time = nowTime();
        const siteName = loadSiteName() || "برادران نورزاد";
        const conversion = fromCur !== toCur ? "\n(تبدیل با نرخ روز)" : "";

        const text = `══════════════════════════
${siteName} - رسید انتقال داخلی
══════════════════════════
شماره: #${receiptNo} | تاریخ: ${date} ${time}
فرستنده: ${user.name} | گیرنده: ${receiverUser.name}

کسر از فرستنده: ${fa(amt)} ${CURRENCY_META[fromCur].label}
افزودن به گیرنده: ${fa(receiverAmount)} ${CURRENCY_META[toCur].label}${conversion}

مانده فرستنده: AFN ${fa(senderUpdated.balances?.AFN || 0)} | USD ${fa(senderUpdated.balances?.USD || 0)} | IRR ${fa(senderUpdated.balances?.IRR || 0)}
مانده گیرنده: AFN ${fa(receiverUpdated.balances?.AFN || 0)} | USD ${fa(receiverUpdated.balances?.USD || 0)} | IRR ${fa(receiverUpdated.balances?.IRR || 0)}`;

        const senderTx: Tx = {
          id: Date.now(), receiptNo: `#${receiptNo}-A`, typeLabel: `انتقال داخلی به ${receiverUser.name}`,
          customer: user.name, receiver: receiverUser.name, currency: CURRENCY_META[fromCur].label,
          amount: amt, afnValue: String(toAFNk(amt, fromCur, rates)), status: "موفق", date, time,
          balancesAfter: senderUpdated.balances, phone: user.phone || "",
        };
        const receiverTx: Tx = {
          id: Date.now() + 1, receiptNo: `#${receiptNo}-B`, typeLabel: `دریافت داخلی از ${user.name}`,
          customer: receiverUser.name, receiver: user.name, currency: CURRENCY_META[toCur].label,
          amount: receiverAmount, afnValue: String(toAFNk(receiverAmount, toCur, rates)), status: "موفق", date, time,
          balancesAfter: receiverUpdated.balances, phone: receiverUser.phone || "",
        };
        setTrades([receiverTx, senderTx, ...trades]);

        const phone1 = (user.phone || "").replace(/\D/g, "");
        if (phone1) try { window.open(`https://wa.me/${phone1}?text=${encodeURIComponent(text)}`, "_blank"); } catch { }

        setSendingTg(true);
        const results: string[] = [];
        if ((user.telegram || "").trim()) {
          const ok = await sendTg(user.telegram, text, silent);
          results.push(ok ? `✅ ${user.name}` : `⚠️ ${user.name}`);
        }
        if ((receiverUser.telegram || "").trim()) {
          const ok = await sendTg(receiverUser.telegram, text, silent);
          results.push(ok ? `✅ ${receiverUser.name}` : `⚠️ ${receiverUser.name}`);
        }
        setSendingTg(false);
        setTgStatus(results.length ? "📨 تلگرام: " + results.join(" | ") : "ℹ️ chat_id یافت نشد");

        setReceipt(text); setLastTx(senderTx); setAmount(""); setInternalReceiverId("");
        return;
      }

      // ========== حالت انتقال / تبادل ==========
      if (!customerId || !receiver.trim() || !amount.trim() || amt <= 0) {
        setError("لطفاً مشتری، گیرنده و مبلغ را وارد کنید"); return;
      }
      if (!user) { setError("مشتری پیدا نشد"); return; }

      let updated: any, typeLabel: string, curKey: CurKey;
      if (mode === "انتقال") {
        if ((user.balances[cur] || 0) < amt) { setError(`موجودی کافی نیست. مانده ${CURRENCY_META[cur].label}: ${fa(user.balances[cur] || 0)}`); return; }
        updated = applyTransfer(user, cur, amt);
        typeLabel = "انتقال " + CURRENCY_META[cur].label;
        curKey = cur;
      } else {
        if ((user.balances[fromCur] || 0) < amt) { setError(`موجودی کافی نیست. مانده ${CURRENCY_META[fromCur].label}: ${fa(user.balances[fromCur] || 0)}`); return; }
        updated = applyExchange(user, fromCur, toCur, amt, exchTo);
        typeLabel = `تبادل ${CURRENCY_META[fromCur].label} به ${CURRENCY_META[toCur].label}`;
        curKey = fromCur;
      }

      setUsers(users.map(u => u.id === updated.id ? updated : u));
      const receiptNo = nextReceiptNo();
      const date = todayFa(), time = nowTime();
      const amountLabel = mode === "انتقال"
        ? `${fa(amt)} ${CURRENCY_META[curKey].code}`
        : `${fa(amt)} ${CURRENCY_META[fromCur].code} → ${fa(exchTo)} ${CURRENCY_META[toCur].code}`;
      const siteName = loadSiteName() || "برادران نورزاد";
      const text = buildReceipt({ receiptNo, customer: user.name, typeLabel, amountLabel, receiver, balances: updated.balances, date, time, siteName });

      const tx: Tx = {
        id: Date.now(), receiptNo, typeLabel, customer: user.name, receiver,
        currency: CURRENCY_META[curKey].label, amount: amt,
        afnValue: String(toAFNk(amt, curKey, rates)), status: "موفق", date, time,
        balancesAfter: updated.balances, phone: user.phone || "",
      };
      setTrades([tx, ...trades]);

      const phone = (user.phone || "").replace(/\D/g, "");
      if (phone) try { window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank"); } catch { }

      setSendingTg(true);
      const tgId = (user.telegram || "").trim();
      if (tgId) {
        const ok = await sendTg(tgId, text, silent);
        setTgStatus(ok ? "✅ رسید به تلگرام ارسال شد" : "⚠️ ارسال ناموفق بود");
      } else {
        setTgStatus("ℹ️ مشتری chat_id تلگرام ندارد");
      }
      setSendingTg(false);

      setReceipt(text); setLastTx(tx); setAmount(""); setReceiver("");
    } catch (e) { setError("خطای غیرمنتظره: " + String(e)); }
  };

  const reopen = (t: Tx) => {
    try {
      const text = buildReceipt({
        receiptNo: t.receiptNo, customer: t.customer, typeLabel: t.typeLabel,
        amountLabel: `${fa(t.amount)} ${t.currency}`, receiver: t.receiver,
        balances: t.balancesAfter, date: t.date, time: t.time,
        siteName: loadSiteName() || "برادران نورزاد",
      });
      setReceipt(text); setLastTx(t);
    } catch (e) { setError("خطا در نمایش رسید: " + String(e)); }
  };

  const internalReceiver = users.find(u => u.id === Number(internalReceiverId)) as any;
  const internalReceiverAmount = user && internalReceiver && amt > 0
    ? (fromCur === toCur ? amt : fromAFNk(toAFNk(amt, fromCur, rates), toCur, rates)) : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ثبت معامله (موتور خودکار)</h1>

      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">{mode === "حساب به حساب" ? "فرستنده" : "مشتری"}</label>
          <select className="input" value={customerId} onChange={e => { setCustomerId(e.target.value); clear(); }}>
            <option value="">انتخاب مشتری</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} {(u as any).telegram ? "📨" : ""}</option>)}
          </select>
        </div>

        <SelectField label="نوع معامله" value={mode}
          onChange={v => { setMode(v); clear(); if (v === "حساب به حساب") { setInternalReceiverId(""); setFromCur("AFN"); setToCur("AFN"); } }}
          options={["انتقال", "تبادل", "حساب به حساب"]} />

        {mode === "حساب به حساب" ? (
          <>
            <SelectField label="از ارز" value={fromCur} onChange={v => setFromCur(v as CurKey)} options={curOptions as any} />
            <div>
              <label className="block text-sm font-bold mb-2">مشتری گیرنده</label>
              <select className="input" value={internalReceiverId} onChange={e => setInternalReceiverId(e.target.value)}>
                <option value="">انتخاب گیرنده</option>
                {users.filter(u => u.id !== user?.id).map(u => <option key={u.id} value={u.id}>{u.name} - {u.phone}</option>)}
              </select>
            </div>
            <SelectField label="به ارز" value={toCur} onChange={v => setToCur(v as CurKey)} options={curOptions as any} />
            <Field label="مبلغ" value={amount} onChange={v => { setAmount(v); clear(); }} placeholder="مقدار" />

            {user && internalReceiver && amt > 0 && (
              <div className="sm:col-span-2 lg:col-span-4 bg-gradient-to-r from-[#0b1f2e] to-[#0f2839] rounded-xl p-4 text-white space-y-2">
                <p className="text-[#e3b45c] font-bold text-sm">💱 پیش‌نمایش انتقال داخلی</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-300">کسر از <b>{user.name}</b>:</p>
                    <p className="text-red-300 font-bold text-base">-{fa(amt)} {CURRENCY_META[fromCur].label}</p>
                  </div>
                  <div>
                    <p className="text-slate-300">افزودن به <b>{internalReceiver.name}</b>:</p>
                    <p className="text-emerald-300 font-bold text-base">+{fa(internalReceiverAmount)} {CURRENCY_META[toCur].label}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {mode === "انتقال" ? (
              <SelectField label="ارز انتقال" value={cur} onChange={v => setCur(v as CurKey)} options={curOptions as any} />
            ) : (
              <>
                <SelectField label="از ارز" value={fromCur} onChange={v => setFromCur(v as CurKey)} options={curOptions as any} />
                <SelectField label="به ارز" value={toCur} onChange={v => setToCur(v as CurKey)} options={curOptions as any} />
              </>
            )}
            <Field label="گیرنده" value={receiver} onChange={v => { setReceiver(v); clear(); }} placeholder="نام گیرنده" />
            <Field label="مبلغ" value={amount} onChange={v => { setAmount(v); clear(); }} placeholder="مقدار" />
            {user && (
              <div className="sm:col-span-2 lg:col-span-4 bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <p>مانده <b>{user.name}</b>: 🇦🇫 {fa(user.balances?.AFN || 0)} | 🇺🇸 {fa(user.balances?.USD || 0)} | 🇮🇷 {fa(user.balances?.IRR || 0)}</p>
                {mode === "تبادل" && amt > 0 && <p className="text-[#c98f2d] font-bold">معادل دریافتی: {fa(exchTo)} {CURRENCY_META[toCur].label}</p>}
              </div>
            )}
          </>
        )}

        <div className="lg:col-span-4"><ErrorBox error={error} /></div>
        {tgStatus && (
          <div className={`lg:col-span-4 text-sm rounded-xl p-3 ${tgStatus.startsWith("✅") || tgStatus.startsWith("📨") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : tgStatus.startsWith("⚠️") ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
            {tgStatus}
          </div>
        )}
        <div className="lg:col-span-4">
          <button className="btn-gold w-full" onClick={submit} disabled={sendingTg}>
            {sendingTg ? "⏳ در حال ارسال..." : mode === "حساب به حساب" ? "ثبت انتقال داخلی ✅" : "ثبت معامله ✅"}
          </button>
        </div>
      </div>

      <DataTable headers={["رسید", "مشتری", "نوع", "مبلغ", "وضعیت", "عملیات"]} emptyText="هنوز معامله‌ای ثبت نشده" colSpan={7}>
        {trades.length === 0 ? null : trades.map((t, index) => (
          <tr key={t.id} className="hover:bg-amber-50/40">
            <RowNumber index={index} />
            <td className="px-4 py-3 font-bold text-[#c98f2d]">{t.receiptNo}</td>
            <td className="px-4 py-3 font-bold">{t.customer}</td>
            <td className="px-4 py-3">{t.typeLabel}</td>
            <td className="px-4 py-3">{fa(t.amount)} {t.currency}</td>
            <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(t.status)}`}>{t.status}</span></td>
            <td className="px-4 py-3">
              <button className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 text-xs font-bold" onClick={() => reopen(t)}>مشاهده رسید</button>
            </td>
          </tr>
        ))}
      </DataTable>

      {receipt && lastTx && (
        <Modal title={`رسید ${lastTx.receiptNo}`} onClose={() => setReceipt("")}>
          <pre className="whitespace-pre-wrap text-sm bg-slate-50 rounded-xl p-4 leading-6">{receipt}</pre>
          <div className="mt-4">
            <ShareBar text={receipt} phone={lastTx.phone} pdfTitle={`رسید ${lastTx.receiptNo}`}
              pdfRows={[
                { label: "شماره رسید", value: lastTx.receiptNo },
                { label: "مشتری", value: lastTx.customer },
                { label: "نوع", value: lastTx.typeLabel },
                { label: "گیرنده", value: lastTx.receiver },
                { label: "تاریخ", value: lastTx.date + " " + lastTx.time },
              ]} />
          </div>
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setReceipt("")}>بستن</button>
        </Modal>
      )}
    </div>
  );
}

// =================================================================
// 👥 TAB 4: USERS
// =================================================================
function UsersTab() {
  const [raw, setRaw] = useStored<any[]>("db_users", [
    { id: 1, name: "احمد", phone: "93700000000", telegram: "", balances: { AFN: 300000, USD: 1200, IRR: 85000000 }, status: "فعال" },
  ]);
  const users = raw.map((u: any) => ({
    id: u.id, name: u.name || "", phone: u.phone || "", telegram: u.telegram || "",
    status: u.status || "فعال",
    balances: u.balances || { AFN: Number(u.balance || 0), USD: 0, IRR: 0 },
  }));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyUserForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [shareUser, setShareUser] = useState<any | null>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);

  useEffect(() => {
    try {
      const r = localStorage.getItem("db_telegram_users");
      if (r) setTelegramUsers(JSON.parse(r));
    } catch { }
  }, []);

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };

  const save = () => {
    const m = checkRequired(form, [{ key: "name", label: "نام" }, { key: "phone", label: "شماره تماس" }]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    const balances = { AFN: Number(form.AFN || 0), USD: Number(form.USD || 0), IRR: Number(form.IRR || 0) };
    if (editId) {
      setRaw(raw.map((u: any) => u.id === editId ? { ...u, name: form.name, phone: form.phone, telegram: form.telegram, balances } : u));
    } else {
      setRaw([...raw, { id: Date.now(), name: form.name, phone: form.phone, telegram: form.telegram, balances, status: "فعال" }]);
    }
    setModal(false); setForm(emptyUserForm); setEditId(null);
  };

  const selectedTgUser = telegramUsers.find(tu => String(tu.id) === form.telegram);
  const filtered = users.filter(u => u.name.includes(search) || u.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">مشتریان و حساب‌ها</h1>
        <button className="btn-gold" onClick={() => { setForm(emptyUserForm); setEditId(null); setMissing([]); setError(""); setModal(true); }}>+ افزودن مشتری</button>
      </div>

      <div className="max-w-sm">
        <label className="block text-sm font-bold mb-2">جستجوی مشتری</label>
        <input className="input" placeholder="نام یا شماره..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <DataTable headers={["نام", "تماس", "🇦🇫 افغانی", "🇺🇸 دالر", "🇮🇷 تومان", "تلگرام", "عملیات"]} emptyText="هیچ مشتری‌ای یافت نشد" colSpan={8}>
        {filtered.length === 0 ? null : filtered.map((u, index) => (
          <tr key={u.id} className="hover:bg-amber-50/40">
            <RowNumber index={index} />
            <td className="px-4 py-3 font-bold">{u.name}</td>
            <td className="px-4 py-3 text-slate-500 text-xs">{u.phone}</td>
            <td className="px-4 py-3">{fa(u.balances.AFN)}</td>
            <td className="px-4 py-3">{fa(u.balances.USD)}</td>
            <td className="px-4 py-3">{fa(u.balances.IRR)}</td>
            <td className="px-4 py-3">
              {u.telegram ? (
                <span className="text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">✓ متصل</span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              )}
            </td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100" onClick={() => setShareUser(u)}>اشتراک</button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => {
                  setEditId(u.id);
                  setForm({ name: u.name, phone: u.phone, telegram: u.telegram || "", AFN: String(u.balances.AFN), USD: String(u.balances.USD), IRR: String(u.balances.IRR) });
                  setMissing([]); setError(""); setModal(true);
                }}>ویرایش</button>
                <button className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setRaw(raw.filter(x => x.id !== u.id))}>حذف</button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      {modal && (
        <Modal title={editId ? "ویرایش حساب مشتری" : "مشتری جدید"} onClose={() => setModal(false)}>
          <div className="space-y-3">
            <Field label="نام" name="نام" missing={missing} value={form.name} onChange={v => set({ name: v })} />
            <Field label="شماره تماس (واتساپ)" name="شماره تماس" missing={missing} value={form.phone} onChange={v => set({ phone: v })} placeholder="93700000000" />

            <div>
              <label className="block text-sm font-bold mb-2">تلگرام (chat_id)</label>
              <div className="flex gap-2">
                <input className="input flex-1 font-mono text-sm" dir="ltr" value={form.telegram}
                  onChange={e => set({ telegram: e.target.value })} placeholder="chat_id را تایپ یا انتخاب کنید" />
                <button type="button" className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 whitespace-nowrap border border-slate-200"
                  onClick={() => setShowTelegramModal(true)}>📋 انتخاب</button>
              </div>
              {selectedTgUser && (
                <div className="mt-2 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                  <p className="text-xs text-sky-700 font-bold">✓ کاربر انتخاب‌شده:</p>
                  <p className="text-sm text-sky-900 font-bold mt-1">{selectedTgUser.firstName} {selectedTgUser.lastName || ""}</p>
                  <p className="text-xs text-sky-600 mt-0.5">
                    {selectedTgUser.username ? `@${selectedTgUser.username} • ` : ""}
                    chat_id: <span className="font-mono font-bold">{selectedTgUser.id}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <Field label="مانده افغانی" value={form.AFN} onChange={v => set({ AFN: v })} placeholder="0" />
              <Field label="مانده دالر" value={form.USD} onChange={v => set({ USD: v })} placeholder="0" />
              <Field label="مانده تومان" value={form.IRR} onChange={v => set({ IRR: v })} placeholder="0" />
            </div>
            <ErrorBox error={error} />
          </div>
          <div className="flex gap-2 mt-5">
            <button className="btn-gold flex-1" onClick={save}>ذخیره</button>
            <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold" onClick={() => setModal(false)}>انصراف</button>
          </div>
        </Modal>
      )}

      {showTelegramModal && (
        <Modal title="انتخاب کاربر تلگرام" onClose={() => setShowTelegramModal(false)}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {telegramUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="font-bold mb-2">هیچ کاربری ثبت نشده</p>
                <p className="text-xs">ابتدا در تنظیمات ربات، «به‌روزرسانی لیست» را بزنید</p>
              </div>
            ) : (
              telegramUsers.map(tu => (
                <button key={tu.id} type="button"
                  className={`w-full text-right p-3 rounded-xl border transition-colors ${String(tu.id) === form.telegram ? "bg-sky-100 border-sky-400" : "border-slate-200 hover:bg-sky-50"}`}
                  onClick={() => { set({ telegram: String(tu.id) }); setShowTelegramModal(false); }}>
                  <div className="font-bold text-sm text-[#0b1f2e]">{tu.firstName} {tu.lastName || ""}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {tu.username ? `@${tu.username} • ` : ""}chat_id: <span className="font-mono font-bold">{tu.id}</span>
                  </div>
                </button>
              ))
            )}
          </div>
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setShowTelegramModal(false)}>بستن</button>
        </Modal>
      )}

      {shareUser && (
        <Modal title="اشتراک‌گذاری حساب مشتری" onClose={() => setShareUser(null)}>
          <div className="text-sm space-y-1 mb-4 bg-slate-50 rounded-xl p-4">
            <p><b>نام:</b> {shareUser.name}</p>
            <p><b>شماره:</b> {shareUser.phone}</p>
            <p><b>🇦🇫 افغانی:</b> {fa(shareUser.balances.AFN)}</p>
            <p><b>🇺🇸 دالر:</b> {fa(shareUser.balances.USD)}</p>
            <p><b>🇮🇷 تومان:</b> {fa(shareUser.balances.IRR)}</p>
          </div>
          <ShareBar
            text={`مشتری: ${shareUser.name}\nشماره: ${shareUser.phone}\nافغانی: ${fa(shareUser.balances.AFN)}\nدالر: ${fa(shareUser.balances.USD)}\nتومان: ${fa(shareUser.balances.IRR)}`}
            phone={shareUser.phone} pdfTitle="صورت حساب مشتری"
            pdfRows={[
              { label: "نام", value: shareUser.name },
              { label: "شماره", value: shareUser.phone },
              { label: "افغانی", value: fa(shareUser.balances.AFN) },
              { label: "دالر", value: fa(shareUser.balances.USD) },
              { label: "تومان", value: fa(shareUser.balances.IRR) },
            ]} />
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setShareUser(null)}>بستن</button>
        </Modal>
      )}
    </div>
  );
}

// =================================================================
// 💹 TAB 5: RATES
// =================================================================
function RatesTab() {
  const [rates, setRates] = useState({ usd: "70.5", eur: "76", toman: "0.64" });
  const [updated, setUpdated] = useState("");
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const r = localStorage.getItem("db_rates");
      if (r) setRates({ ...rates, ...JSON.parse(r) });
      const u = localStorage.getItem("db_rates_updated");
      if (u) setUpdated(u);
    } catch { }
  }, []);

  const update = (key: string, value: string) => { setRates({ ...rates, [key]: value }); setMissing([]); setError(""); };

  const save = () => {
    const m: string[] = [];
    if (!rates.usd.trim() || isNaN(Number(rates.usd))) m.push("نرخ دلار");
    if (!rates.eur.trim() || isNaN(Number(rates.eur))) m.push("نرخ یورو");
    if (!rates.toman.trim() || isNaN(Number(rates.toman))) m.push("نرخ تومان");
    if (m.length > 0) { setMissing(m); setError("لطفاً این نرخ‌ها را درست وارد کنید: " + m.join("، ")); return; }
    setMissing([]); setError("");
    const now = new Date().toLocaleString("fa-IR");
    localStorage.setItem("db_rates", JSON.stringify(rates));
    localStorage.setItem("db_rates_updated", now);
    setUpdated(now); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const items = [
    { key: "usd", title: "دلار آمریکا", desc: "نرخ ۱ دلار به افغانی" },
    { key: "eur", title: "یورو", desc: "نرخ ۱ یورو به افغانی" },
    { key: "toman", title: "تومان ایران", desc: "نرخ ۱۰۰ تومان به افغانی" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">نرخ روز ارزها</h1>
          {updated && <p className="text-xs text-slate-500 mt-1">آخرین به‌روزرسانی: {updated}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-gold" onClick={save}>ذخیره نرخ‌ها</button>
          {saved && <span className="text-emerald-600 text-sm font-bold">ذخیره شد</span>}
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map(item => (
          <div key={item.key} className="card p-6">
            <p className="font-extrabold">{item.title}</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">{item.desc}</p>
            <label className="block text-sm font-bold mb-2">نرخ به افغانی</label>
            <input className={`input text-center text-xl font-extrabold text-[#c98f2d] ${missing.includes(item.title) ? "!border-red-500" : ""}`}
              value={rates[item.key as keyof typeof rates]} onChange={e => update(item.key, e.target.value)} />
            <p className="text-xs text-slate-400 mt-3 text-center">افغانی</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// =================================================================
// 🛠️ TAB 6: SETTINGS
// =================================================================
function SettingsTab() {
  const [settings, setSettings] = useStored<any>("db_settings", {
    siteName: "صرافی برادران نورزاد", address: "هرات، افغانستان", phone: "+93 700 000 000",
    telegramToken: "", telegramChatId: "", telegramSilent: false, username: "admin", password: "admin123",
  });
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState("");
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [botInfo, setBotInfo] = useState<any>(null);
  const [openSection, setOpenSection] = useState<string>("general");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("db_telegram_users");
      if (stored) setTelegramUsers(JSON.parse(stored));
    } catch { }
  }, []);

  useEffect(() => {
    if (settings.telegramToken) getBotInfo(settings.telegramToken).then(setBotInfo);
  }, [settings.telegramToken]);

  const set = (patch: any) => { setSettings({ ...settings, ...patch }); setError(""); setSuccess(""); };
  const saveSettings = () => { setSettings(settings); setSuccess("✅ تنظیمات ذخیره شد"); setTimeout(() => setSuccess(""), 3000); };

  const testTelegram = async () => {
    if (!settings.telegramToken?.trim() || !settings.telegramChatId?.trim()) { setError("⚠️ توکن و chat_id را وارد کنید"); return; }
    setLoading(true);
    try {
      const message = `🎉 تست ربات تلگرام\nصرافی: ${settings.siteName}\nتاریخ: ${new Date().toLocaleDateString("fa-IR")}`;
      const ok = await sendTelegram(settings.telegramToken, settings.telegramChatId, message, { silent: settings.telegramSilent === true });
      setTestResult(ok ? "✅ پیام تست ارسال شد" : "❌ ارسال ناموفق");
    } catch (e) { setTestResult("❌ خطا: " + String(e)); }
    setLoading(false);
  };

  const fetchChatId = async () => {
    if (!settings.telegramToken?.trim()) { setError("⚠️ توکن را وارد کنید"); return; }
    setLoading(true);
    try {
      const chatId = await getLastChatId(settings.telegramToken);
      if (chatId) { set({ telegramChatId: String(chatId) }); setSuccess(`✅ chat_id: ${chatId}`); }
      else setError("❌ پیامی یافت نشد. /start بفرستید");
    } catch { setError("❌ خطا"); }
    setLoading(false);
  };

  const refreshUsers = async () => {
    if (!settings.telegramToken?.trim()) { setError("⚠️ توکن را وارد کنید"); return; }
    setLoadingUsers(true);
    try {
      const usersList = await getTelegramUsers(settings.telegramToken);
      setTelegramUsers(usersList);
      localStorage.setItem("db_telegram_users", JSON.stringify(usersList));
      setSuccess(`✅ ${usersList.length} کاربر دریافت شد`);
    } catch { setError("❌ خطا"); }
    setLoadingUsers(false);
  };

  const copyChatId = (id: number) => {
    navigator.clipboard.writeText(String(id));
    setSuccess(`✅ chat_id ${id} کپی شد`);
    setTimeout(() => setSuccess(""), 2000);
  };

  const toggle = (s: string) => setOpenSection(openSection === s ? "" : s);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold flex items-center gap-2">🛠️ تنظیمات سیستم</h1>

      {/* اطلاعات عمومی */}
      <AccordionSection icon="🏢" title="اطلاعات عمومی" subtitle="نام و مشخصات صرافی" isOpen={openSection === "general"} onToggle={() => toggle("general")}>
        <Field label="🏷️ نام صرافی" value={settings.siteName || ""} onChange={v => set({ siteName: v })} />
        <Field label="📍 آدرس" value={settings.address || ""} onChange={v => set({ address: v })} />
        <Field label="📱 شماره تماس" value={settings.phone || ""} onChange={v => set({ phone: v })} />
      </AccordionSection>

      {/* ربات تلگرام */}
      <AccordionSection icon="🤖" title="تنظیمات ربات تلگرام" subtitle={botInfo ? `@${botInfo.username}` : "مدیریت ربات"} isOpen={openSection === "telegram"} onToggle={() => toggle("telegram")} accent="border-2 border-sky-200">
        <div>
          <label className="block text-sm font-bold mb-2">🔐 توکن ربات تلگرام</label>
          <input className="input font-mono text-sm" dir="ltr" value={settings.telegramToken || ""}
            onChange={e => set({ telegramToken: e.target.value })} placeholder="123456:ABC-DEF..." />
        </div>

        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              📊 لیست کاربران ربات
              <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-mono">{telegramUsers.length} کاربر</span>
            </h3>
            <button onClick={refreshUsers} disabled={loadingUsers}
              className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 disabled:opacity-50 flex items-center gap-1">
              {loadingUsers ? "⏳" : "🔄"} به‌روزرسانی
            </button>
          </div>
          {telegramUsers.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {telegramUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 hover:border-sky-300">
                  <div className="flex-1">
                    <div className="font-bold text-sm text-[#0b1f2e]">{user.firstName} {user.lastName || ""}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {user.username ? `@${user.username} • ` : ""}chat_id: <span className="font-mono font-bold">{user.id}</span>
                    </div>
                  </div>
                  <button onClick={() => copyChatId(user.id)} className="text-xs px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 font-bold">📋 کپی</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={settings.telegramSilent !== true}
              onChange={e => set({ telegramSilent: !e.target.checked })} className="w-5 h-5 rounded" />
            <div>
              <p className="font-bold text-sm text-[#0b1f2e]">🔊 ارسال پیام با صدا</p>
              <p className="text-xs text-slate-500 mt-0.5">مشتری‌ها صدای نوتیفیکیشن را می‌شنوند</p>
            </div>
          </label>
        </div>

        <div>
          <label className="block text-sm font-bold mb-2">💬 chat_id اصلی (برای تست)</label>
          <div className="flex gap-2">
            <input className="input flex-1 font-mono text-sm" dir="ltr" value={settings.telegramChatId || ""}
              onChange={e => set({ telegramChatId: e.target.value })} placeholder="123456789" />
            <button onClick={fetchChatId} disabled={loading}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 disabled:opacity-50 whitespace-nowrap">
              {loading ? "⏳" : "📥"} دریافت خودکار
            </button>
          </div>
        </div>

        <button onClick={testTelegram} disabled={loading}
          className="w-full rounded-xl bg-sky-500 text-white py-2.5 text-sm font-bold hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? "⏳ در حال ارسال..." : "🧪 تست ارسال پیام"}
        </button>
        {testResult && (
          <div className={`text-sm rounded-lg p-3 text-center font-bold ${testResult.startsWith("✅") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {testResult}
          </div>
        )}
      </AccordionSection>

      {/* امنیت */}
      <AccordionSection icon="🔐" title="امنیت ورود" subtitle="نام کاربری و رمز عبور" isOpen={openSection === "security"} onToggle={() => toggle("security")}>
        <Field label="👤 نام کاربری" value={settings.username || "admin"} onChange={v => set({ username: v })} />
        <Field label="🔑 رمز عبور" value={settings.password || "admin123"} onChange={v => set({ password: v })} />
      </AccordionSection>

      <div className="card p-4">
        <button onClick={saveSettings} className="btn-gold w-full flex items-center justify-center gap-2 py-3">
          <span className="font-bold">💾 ذخیره همه تنظیمات</span>
        </button>
      </div>

      <ErrorBox error={error} />
      {success && <div className="text-sm rounded-xl p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">{success}</div>}
    </div>
  );
}

// =================================================================
// 🎫 TAB 7: TICKETS
// =================================================================
function TicketsTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replyId, setReplyId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const s = localStorage.getItem("db_tickets");
      if (s) setTickets(JSON.parse(s));
      else setTickets([
        { id: 1, user: "علی محمدی", subject: "مشکل در برداشت", date: "۱۴۰۳/۰۵/۲۰", status: "باز", reply: "" },
        { id: 2, user: "سارا احمدی", subject: "تغییر رمز عبور", date: "۱۴۰۳/۰۵/۱۸", status: "بسته", reply: "رمز شما بازنشانی شد." },
      ]);
    } catch { }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("db_tickets", JSON.stringify(tickets)); } catch { }
  }, [tickets]);

  const send = () => {
    if (!text.trim()) { setError("لطفاً متن پاسخ را بنویسید"); return; }
    setError("");
    setTickets(tickets.map(t => t.id === replyId ? { ...t, reply: text, status: "بسته" } : t));
    setReplyId(null); setText("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">تیکت‌های پشتیبانی</h1>
      <div className="space-y-4">
        {tickets.length === 0 && <div className="card p-8 text-center text-slate-400">هیچ تیکتی ثبت نشده است</div>}
        {tickets.map(t => (
          <div key={t.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-extrabold">{t.subject}</p>
                <p className="text-xs text-slate-500 mt-1">{t.user} — {t.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full border ${t.status === "باز" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{t.status}</span>
                <button className="btn-gold !py-1.5 !px-4 text-xs" onClick={() => { setReplyId(t.id); setText(t.reply); setError(""); }}>پاسخ</button>
              </div>
            </div>
            {t.reply && <div className="mt-4 bg-amber-50/60 border border-amber-100 rounded-xl p-4 text-sm">{t.reply}</div>}
          </div>
        ))}
      </div>

      {replyId && (
        <Modal title="پاسخ به تیکت" onClose={() => setReplyId(null)}>
          <label className="block text-sm font-bold mb-2">متن پاسخ</label>
          <textarea className={`input min-h-[120px] ${error ? "!border-red-500" : ""}`} value={text}
            onChange={e => { setText(e.target.value); setError(""); }} placeholder="متن پاسخ..." />
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200 mt-3">{error}</div>}
          <div className="flex gap-2 mt-4">
            <button className="btn-gold flex-1" onClick={send}>ارسال و بستن تیکت</button>
            <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold" onClick={() => setReplyId(null)}>انصراف</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =================================================================
// 🎯 MAIN COMPONENT
// =================================================================
export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard", label: "داشبورد", icon: "📊" },
    { id: "hawala", label: "حواله‌جات", icon: "💸" },
    { id: "trades", label: "تبادل ارز", icon: "💱" },
    { id: "users", label: "مشتریان", icon: "👥" },
    { id: "rates", label: "نرخ ارز", icon: "💹" },
    { id: "settings", label: "تنظیمات", icon: "🛠️" },
    { id: "tickets", label: "تیکت‌ها", icon: "🎫" },
  ];

  return (
    <div className="space-y-6">
      <div className="card p-2 flex gap-1 overflow-x-auto sticky top-0 z-10 bg-[#f6f4ee]">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              activeTab === tab.id ? "bg-[#0b1f2e] text-[#e3b45c] shadow-md" : "text-slate-600 hover:bg-white"
            }`}>
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "hawala" && <HawalaTab />}
        {activeTab === "trades" && <TradesTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "rates" && <RatesTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "tickets" && <TicketsTab />}
      </div>
    </div>
  );
}
