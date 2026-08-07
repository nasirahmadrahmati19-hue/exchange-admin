"use client";

import { useState, useMemo } from "react";
import { useStored, Field, SelectField, ErrorBox, Modal } from "../lib/ui";
import {
  loadRates, toAFN, fromAFN, fa, todayFa, checkRequired, requiredMessage,
  CURRENCIES, CITIES,
} from "../lib/helpers";

interface Hawala {
  id: number;
  sender: string;
  receiver: string;
  phone: string;
  fromCity: string;
  toCity: string;
  payCur: string;
  getCur: string;
  amount: string;
  result: string;
  fee: string;
  date: string;
  status: string;
  trackCode?: string;
  manualRate?: string;
}

const emptyForm = {
  sender: "", receiver: "", phone: "", fromCity: "هرات", toCity: "مشهد",
  payCur: "افغانی", getCur: "تومان", amount: "", fee: "0", manualRate: "",
};

const generateTrackCode = () => "HW-" + Math.random().toString(36).substring(2, 8).toUpperCase();

const statusStyle = (status: string) => {
  if (status === "در حال انتظار") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "پرداخت شد") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "لغو شد") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export default function HawalaPage() {
  const [list, setList] = useStored<Hawala[]>("db_hawala", []);
  const [rates] = useState(loadRates());
  const [subTab, setSubTab] = useState("register");

  const [form, setForm] = useState(emptyForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastTrackCode, setLastTrackCode] = useState("");

  const [historyFilter, setHistoryFilter] = useState("همه");
  const [historySearch, setHistorySearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };
  
  const needsRate = form.payCur !== form.getCur;
  const effectiveRate = form.manualRate && !isNaN(Number(form.manualRate)) ? Number(form.manualRate) : 0;
  
  const calcResult = () => {
    const amountNum = Number(form.amount || 0);
    const feeNum = Number(form.fee || 0);
    if (amountNum <= 0) return 0;
    
    if (!needsRate) {
      return Math.max(amountNum - feeNum, 0);
    }
    
    if (effectiveRate > 0) {
      return Math.max(amountNum * effectiveRate - feeNum, 0);
    }
    
    return fromAFN(Math.max(toAFN(amountNum, form.payCur, rates) - feeNum, 0), form.getCur, rates);
  };
  
  const result = calcResult();

  const pendingList = list.filter(h => h.status === "در حال انتظار");
  const paidList = list.filter(h => h.status === "پرداخت شد");
  const cancelledList = list.filter(h => h.status === "لغو شد");

  const stats = useMemo(() => {
    let totalAmount = 0, totalFee = 0;
    const customers: Record<string, { count: number; volume: number; type: string; transactions: Hawala[] }> = {};

    list.forEach(h => {
      totalAmount += Number(h.amount || 0);
      totalFee += Number(h.fee || 0);

      if (h.sender) {
        if (!customers[h.sender]) customers[h.sender] = { count: 0, volume: 0, type: "فرستنده", transactions: [] };
        customers[h.sender].count++;
        customers[h.sender].volume += Number(h.amount || 0);
        customers[h.sender].transactions.push(h);
      }
      if (h.receiver) {
        if (!customers[h.receiver]) customers[h.receiver] = { count: 0, volume: 0, type: "گیرنده", transactions: [] };
        customers[h.receiver].count++;
        customers[h.receiver].volume += Number(h.result || 0);
        customers[h.receiver].transactions.push(h);
      }
    });

    return { totalAmount, totalFee, customers };
  }, [list]);

  const add = () => {
    const required: { key: string; label: string }[] = [
      { key: "sender", label: "نام فرستنده" },
      { key: "receiver", label: "نام گیرنده" },
      { key: "amount", label: "مبلغ" },
    ];
    
    if (form.payCur !== form.getCur) {
      required.push({ key: "manualRate", label: "نرخ توافقی" });
    }
    
    const m = checkRequired(form, required);
    
    if (form.payCur !== form.getCur && form.manualRate && (isNaN(Number(form.manualRate)) || Number(form.manualRate) <= 0)) {
      setError("نرخ توافقی باید یک عدد معتبر و بزرگتر از صفر باشد");
      return;
    }
    
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }

    const trackCode = generateTrackCode();
    const newHawala: Hawala = {
      id: Date.now(),
      ...form,
      result: result.toFixed(0),
      date: todayFa(),
      status: "در حال انتظار",
      trackCode,
    };
    setList([newHawala, ...list]);
    setForm({ ...emptyForm });
    setLastTrackCode(trackCode);
    setSuccess(`✨ حواله ثبت شد | کد پیگیری: ${trackCode}`);
    setTimeout(() => setSuccess(""), 5000);
  };

  const updateStatus = (id: number, status: string) => {
    setList(list.map(h => h.id === id ? { ...h, status } : h));
    setSuccess(`✨ وضعیت به «${status}» تغییر کرد`);
    setTimeout(() => setSuccess(""), 2000);
  };

  const wa = (h: Hawala) => {
    const msg = encodeURIComponent(
      `صرافی برادران نورزاد هرات\n` +
      `کد پیگیری: ${h.trackCode || "-"}\n` +
      `حواله از ${h.fromCity} به ${h.toCity}\n` +
      `گیرنده: ${h.receiver}\n` +
      `مبلغ قابل دریافت: ${fa(Number(h.result))} ${h.getCur}\n` +
      `فرستنده: ${h.sender}` +
      (h.manualRate ? `\nنرخ: ${h.manualRate}` : "")
    );
    return `https://wa.me/${h.phone}?text=${msg}`;
  };

  const filteredHistory = list.filter(h => {
    const matchStatus = historyFilter === "همه" || h.status === historyFilter;
    const matchSearch = h.sender.includes(historySearch) ||
      h.receiver.includes(historySearch) ||
      (h.trackCode || "").includes(historySearch.toUpperCase());
    return matchStatus && matchSearch;
  });

  const subTabs = [
    { id: "register", label: "ثبت حواله", icon: "💸" },
    { id: "history", label: "تاریخچه", icon: "📊" },
    { id: "reports", label: "گزارشات", icon: "📈" },
    { id: "customers", label: "مشتریان", icon: "👥" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold flex items-center gap-3">
          <span className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg">
            💸
          </span>
          حواله‌جات
        </h1>
        <div className="flex gap-2 text-sm">
          <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full font-bold border border-amber-200">
            ⏳ {pendingList.length}
          </span>
          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full font-bold border border-emerald-200">
            ✅ {paidList.length}
          </span>
          <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-bold border border-red-200">
            🚫 {cancelledList.length}
          </span>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="card p-2 flex gap-1 overflow-x-auto sticky top-0 z-10 bg-[#f6f4ee] rounded-2xl shadow-lg">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setSubTab(tab.id); setError(""); setSuccess(""); }}
            className={`px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              subTab === tab.id
                ? "bg-gradient-to-r from-[#0b1f2e] to-[#16374d] text-[#e3b45c] shadow-lg"
                : "text-slate-600 hover:bg-white hover:shadow-md"
            }`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {success && (
        <div className="text-sm rounded-2xl p-4 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-2 border-emerald-200 font-bold shadow-lg">
          {success}
        </div>
      )}
      {error && (
        <div className="text-sm rounded-2xl p-4 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-2 border-red-200 font-bold shadow-lg">
          {error}
        </div>
      )}

      {/* ================================================================ */}
      {/* 💸 بخش ۱: ثبت حواله */}
      {/* ================================================================ */}
      {subTab === "register" && (
        <div className="space-y-6">
          <div className="card p-6 rounded-3xl shadow-xl border border-slate-100">
            <h2 className="text-lg font-extrabold mb-6 flex items-center gap-2">
              <span className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-xl shadow-md">💸</span>
              ثبت حواله جدید
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-4">
                <Field label="نام فرستنده" name="نام فرستنده" missing={missing} value={form.sender} onChange={v => set({ sender: v })} placeholder="مثال: احمد ولی" />
                <Field label="نام گیرنده" name="نام گیرنده" missing={missing} value={form.receiver} onChange={v => set({ receiver: v })} placeholder="مثال: کریم الله" />
              </div>
              
              <div className="space-y-4">
                <Field label="شماره واتساپ گیرنده" value={form.phone} onChange={v => set({ phone: v })} placeholder="93... یا 989..." />
                <Field label="مبلغ" name="مبلغ" missing={missing} value={form.amount} onChange={v => set({ amount: v })} placeholder="مبلغ پرداختی" />
              </div>

              <div className="space-y-4">
                <SelectField label="شهر مبدأ" value={form.fromCity} onChange={v => set({ fromCity: v })} options={CITIES} />
                <SelectField label="شهر مقصد" value={form.toCity} onChange={v => set({ toCity: v })} options={CITIES} />
              </div>

              <div className="space-y-4">
                <SelectField label="ارز پرداخت" value={form.payCur} onChange={v => set({ payCur: v })} options={CURRENCIES} />
                <SelectField label="ارز دریافت" value={form.getCur} onChange={v => set({ getCur: v })} options={CURRENCIES} />
              </div>

              <div className="space-y-4">
                <Field label="کارمزد (افغانی)" value={form.fee} onChange={v => set({ fee: v })} placeholder="0" />
              </div>
              
              {/* فیلد نرخ توافقی - فقط وقتی ارزها متفاوت هستند */}
              {form.payCur !== form.getCur && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <div className="bg-gradient-to-r from-[#0b1f2e] to-[#16374d] rounded-2xl p-5 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[#e3b45c] font-extrabold text-base flex items-center gap-2">
                        <span className="text-xl">💱</span>
                        نرخ توافقی
                      </span>
                      <button 
                        onClick={() => set({ manualRate: "" })} 
                        className="text-xs bg-red-500/20 text-red-200 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors font-bold"
                      >
                        🗑️ پاک کردن
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm whitespace-nowrap font-medium">۱ {form.payCur} =</span>
                      <input 
                        type="text"
                        value={form.manualRate} 
                        onChange={e => set({ manualRate: e.target.value })}
                        placeholder="نرخ را وارد کنید"
                        name="manualRate"
                        className={`input flex-1 text-center text-[#e3b45c] font-extrabold !border-[#e3b45c]/30 !bg-white/10 !text-white ${missing.includes("نرخ توافقی") ? "!border-red-500" : ""}`}
                      />
                      <span className="text-white text-sm whitespace-nowrap font-medium">{form.getCur}</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-3">
                      💡 نرخ توافقی با مشتری را وارد کنید (اجباری)
                    </p>
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-sm font-bold mb-2 invisible">-</label>
                <div className="flex items-center justify-between bg-gradient-to-r from-[#0b1f2e] to-[#16374d] rounded-2xl px-5 py-4 shadow-lg">
                  <span className="text-[#e3b45c] text-sm font-extrabold flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    قابل دریافت:
                  </span>
                  <span className="text-white text-2xl font-black">{fa(result)} {form.getCur}</span>
                </div>
              </div>

              <div className="flex items-end">
                <button className="btn-gold w-full py-4 rounded-2xl text-base font-extrabold shadow-xl hover:shadow-2xl transition-shadow" onClick={add}>
                  ✨ ثبت حواله
                </button>
              </div>

              <div className="lg:col-span-4"><ErrorBox error="" /></div>
            </div>
          </div>

          {lastTrackCode && (
            <div className="card p-6 bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-3xl shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-sky-700 flex items-center gap-2">
                    <span className="text-xl">🔍</span>
                    کد پیگیری حواله:
                  </p>
                  <p className="text-2xl font-black text-sky-900 font-mono mt-2">{lastTrackCode}</p>
                </div>
                <button
                  className="px-6 py-3 rounded-xl bg-sky-500 text-white text-sm font-bold hover:bg-sky-600 shadow-lg transition-all hover:scale-105"
                  onClick={() => {
                    navigator.clipboard.writeText(lastTrackCode);
                    setSuccess("📋 کد پیگیری کپی شد");
                    setTimeout(() => setSuccess(""), 2000);
                  }}
                >
                  📋 کپی
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* 📊 بخش ۲: تاریخچه */}
      {/* ================================================================ */}
      {subTab === "history" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold flex items-center gap-3">
              <span className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center text-xl shadow-md">📊</span>
              تاریخچه حواله‌ها
            </h2>
            <div className="flex gap-2">
              <select
                className="input !w-auto text-sm rounded-xl"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
              >
                <option>همه</option>
                <option>در حال انتظار</option>
                <option>پرداخت شد</option>
                <option>لغو شد</option>
              </select>
              <input
                className="input !w-auto text-sm rounded-xl"
                placeholder="🔎 جستجو: نام یا کد پیگیری..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-x-auto rounded-3xl shadow-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-[#0b1f2e] to-[#16374d] text-[#e3b45c]">
                <tr>
                  <th className="text-center px-4 py-4 font-extrabold w-16">ردیف</th>
                  <th className="text-right px-4 py-4 font-extrabold">کد پیگیری</th>
                  <th className="text-right px-4 py-4 font-extrabold">فرستنده</th>
                  <th className="text-right px-4 py-4 font-extrabold">گیرنده</th>
                  <th className="text-right px-4 py-4 font-extrabold">مسیر</th>
                  <th className="text-right px-4 py-4 font-extrabold">مبلغ</th>
                  <th className="text-right px-4 py-4 font-extrabold">دریافتی</th>
                  <th className="text-right px-4 py-4 font-extrabold">نرخ</th>
                  <th className="text-right px-4 py-4 font-extrabold">وضعیت</th>
                  <th className="text-right px-4 py-4 font-extrabold">تاریخ</th>
                  <th className="text-right px-4 py-4 font-extrabold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={11} className="text-center py-12 text-slate-400">
                    <p className="text-4xl mb-3">📊</p>
                    <p className="font-bold">حواله‌ای یافت نشد</p>
                  </td></tr>
                ) : (
                  filteredHistory.map((h, index) => (
                    <tr key={h.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-4 py-4 text-center font-mono font-bold text-[#0b1f2e]">
                        {(index + 1).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs bg-gradient-to-r from-slate-100 to-slate-200 px-3 py-1.5 rounded-lg font-bold text-slate-700">
                          {h.trackCode || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-bold">{h.sender}</td>
                      <td className="px-4 py-4">{h.receiver}</td>
                      <td className="px-4 py-4 text-slate-500 text-xs font-medium">{h.fromCity} ← {h.toCity}</td>
                      <td className="px-4 py-4 font-bold">{fa(Number(h.amount))} {h.payCur}</td>
                      <td className="px-4 py-4 font-extrabold text-[#c98f2d]">{fa(Number(h.result))} {h.getCur}</td>
                      <td className="px-4 py-4 text-xs">
                        {h.manualRate ? (
                          <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 font-bold">
                            {h.manualRate}
                          </span>
                        ) : (
                          <span className="text-slate-400">سیستم</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          className={`text-xs px-3 py-2 rounded-xl border font-bold ${statusStyle(h.status)}`}
                          value={h.status}
                          onChange={e => updateStatus(h.id, e.target.value)}
                        >
                          <option>در حال انتظار</option>
                          <option>پرداخت شد</option>
                          <option>لغو شد</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 font-medium">{h.date}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <a href={wa(h)} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
                            💬 واتساپ
                          </a>
                          <button
                            className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors border border-red-200"
                            onClick={() => setList(list.filter(x => x.id !== h.id))}
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 📈 بخش ۳: گزارشات */}
      {/* ================================================================ */}
      {subTab === "reports" && (
        <div className="space-y-6">
          <h2 className="text-xl font-extrabold flex items-center gap-3">
            <span className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-xl shadow-md">📈</span>
            گزارشات حواله‌جات
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="card p-6 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">📊</span>
                </div>
                <div>
                  <p className="text-xs opacity-80 font-bold">مجموع حواله‌ها</p>
                  <p className="text-3xl font-black mt-1">{fa(list.length)}</p>
                </div>
              </div>
              <p className="text-[11px] opacity-70 mt-2">از ابتدای ثبت</p>
            </div>

            <div className="card p-6 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">💰</span>
                </div>
                <div>
                  <p className="text-xs opacity-80 font-bold">حجم کل</p>
                  <p className="text-3xl font-black mt-1">{fa(stats.totalAmount)}</p>
                </div>
              </div>
              <p className="text-[11px] opacity-70 mt-2">مجموع مبالغ ارسالی</p>
            </div>

            <div className="card p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 text-white rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">💵</span>
                </div>
                <div>
                  <p className="text-xs opacity-80 font-bold">مجموع کارمزد</p>
                  <p className="text-3xl font-black mt-1">{fa(stats.totalFee)}</p>
                </div>
              </div>
              <p className="text-[11px] opacity-70 mt-2">افغانی</p>
            </div>

            <div className="card p-6 bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-700 text-white rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <p className="text-xs opacity-80 font-bold">پرداخت شده</p>
                  <p className="text-3xl font-black mt-1">{fa(paidList.length)}</p>
                </div>
              </div>
              <p className="text-[11px] opacity-70 mt-2">از {fa(list.length)} حواله</p>
            </div>
          </div>

          <div className="card p-6 rounded-3xl shadow-xl border border-slate-100">
            <h3 className="font-extrabold text-lg mb-5 flex items-center gap-2">
              <span className="text-xl">📋</span>
              وضعیت حواله‌ها
            </h3>
            <div className="grid grid-cols-3 gap-5">
              <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200">
                <p className="text-3xl font-black text-amber-700">{fa(pendingList.length)}</p>
                <p className="text-xs text-amber-600 font-bold mt-2 flex items-center justify-center gap-1">
                  <span>⏳</span> در حال انتظار
                </p>
              </div>
              <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
                <p className="text-3xl font-black text-emerald-700">{fa(paidList.length)}</p>
                <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center justify-center gap-1">
                  <span>✅</span> پرداخت شد
                </p>
              </div>
              <div className="text-center p-5 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200">
                <p className="text-3xl font-black text-red-700">{fa(cancelledList.length)}</p>
                <p className="text-xs text-red-600 font-bold mt-2 flex items-center justify-center gap-1">
                  <span>🚫</span> لغو شد
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 👥 بخش ۴: مشتریان */}
      {/* ================================================================ */}
      {subTab === "customers" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold flex items-center gap-3">
              <span className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center text-xl shadow-md">👥</span>
              مشتریان حواله‌جات
            </h2>
            <span className="text-sm bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold border border-slate-200">
              {Object.keys(stats.customers).length} مشتری
            </span>
          </div>

          {Object.keys(stats.customers).length === 0 ? (
            <div className="card p-12 text-center text-slate-400 rounded-3xl shadow-xl border border-slate-100">
              <p className="text-5xl mb-4">👥</p>
              <p className="font-extrabold text-lg">هنوز مشتری‌ای ثبت نشده است</p>
              <p className="text-xs mt-2">اولین حواله را ثبت کنید</p>
            </div>
          ) : (
            <div className="card overflow-x-auto rounded-3xl shadow-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-[#0b1f2e] to-[#16374d] text-[#e3b45c]">
                  <tr>
                    <th className="text-center px-4 py-4 font-extrabold w-16">ردیف</th>
                    <th className="text-right px-4 py-4 font-extrabold">نام</th>
                    <th className="text-right px-4 py-4 font-extrabold">نوع</th>
                    <th className="text-right px-4 py-4 font-extrabold">تعداد حواله</th>
                    <th className="text-right px-4 py-4 font-extrabold">حجم کل</th>
                    <th className="text-right px-4 py-4 font-extrabold">جزئیات معاملات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(stats.customers)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([name, info], index) => (
                      <tr key={name} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-4 py-4 text-center font-mono font-bold text-[#0b1f2e]">
                          {(index + 1).toLocaleString("en-US")}
                        </td>
                        <td className="px-4 py-4 font-bold">{name}</td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-3 py-1.5 rounded-xl border font-bold ${
                            info.type === "فرستنده"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {info.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-bold">{fa(info.count)} حواله</td>
                        <td className="px-4 py-4 font-extrabold text-[#c98f2d]">{fa(info.volume)}</td>
                        <td className="px-4 py-4">
                          <button
                            className="px-4 py-2 rounded-xl bg-sky-50 text-sky-600 text-xs font-bold hover:bg-sky-100 flex items-center gap-2 transition-colors border border-sky-200"
                            onClick={() => setSelectedCustomer(name)}
                          >
                            <span>🔍</span> جزئیات
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* مودال جزئیات معاملات مشتری */}
      {/* ================================================================ */}
      {selectedCustomer && stats.customers[selectedCustomer] && (
        <Modal title={`🔍 جزئیات معاملات ${selectedCustomer}`} onClose={() => setSelectedCustomer(null)}>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-5 flex items-center justify-between border border-slate-200">
              <div>
                <p className="font-extrabold text-[#0b1f2e] text-lg">{selectedCustomer}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.customers[selectedCustomer].type} • {fa(stats.customers[selectedCustomer].count)} حواله
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-500">حجم کل:</p>
                <p className="font-extrabold text-[#c98f2d] text-lg">{fa(stats.customers[selectedCustomer].volume)}</p>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3">
              {stats.customers[selectedCustomer].transactions.map((h, i) => (
                <div key={h.id} className="p-4 rounded-2xl border-2 border-slate-200 hover:border-sky-300 transition-colors bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs bg-gradient-to-r from-slate-100 to-slate-200 px-3 py-1.5 rounded-lg font-bold">
                      {h.trackCode || "-"}
                    </span>
                    <span className={`text-xs px-3 py-1.5 rounded-xl border font-bold ${statusStyle(h.status)}`}>
                      {h.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 font-medium">فرستنده:</p>
                      <p className="font-bold">{h.sender}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">گیرنده:</p>
                      <p className="font-bold">{h.receiver}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">مسیر:</p>
                      <p className="font-bold">{h.fromCity} ← {h.toCity}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">مبلغ:</p>
                      <p className="font-bold">{fa(Number(h.amount))} {h.payCur}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">دریافتی:</p>
                      <p className="font-extrabold text-[#c98f2d]">{fa(Number(h.result))} {h.getCur}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-medium">تاریخ:</p>
                      <p className="font-bold">{h.date}</p>
                    </div>
                    {h.manualRate && (
                      <div className="col-span-2">
                        <p className="text-slate-500 font-medium">نرخ توافقی:</p>
                        <p className="font-extrabold text-blue-600">{h.manualRate}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              className="w-full rounded-2xl border-2 border-slate-200 py-3 text-sm font-bold hover:bg-slate-50 transition-colors"
              onClick={() => setSelectedCustomer(null)}
            >
              بستن
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
