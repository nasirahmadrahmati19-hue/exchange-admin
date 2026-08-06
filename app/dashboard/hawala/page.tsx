"use client";

import { useState, useMemo } from "react";
import { useStored, Field, SelectField, ErrorBox, Modal } from "../lib/ui";
import {
  loadRates, toAFN, fromAFN, fa, todayFa, checkRequired, requiredMessage,
  CURRENCIES, CITIES, statusChipClass,
} from "../lib/helpers";

interface Hawala {
  id: number; sender: string; receiver: string; phone: string;
  fromCity: string; toCity: string; payCur: string; getCur: string;
  amount: string; result: string; fee: string; date: string; status: string;
  payMethod?: string; recMethod?: string;
}

const emptyForm = {
  sender: "", receiver: "", phone: "", fromCity: "هرات", toCity: "مشهد",
  payCur: "افغانی", getCur: "تومان", amount: "", fee: "0",
};

export default function HawalaPage() {
  const [list, setList] = useStored<Hawala[]>("db_hawala", []);
  const [rates] = useState(loadRates());
  const [subTab, setSubTab] = useState("register");

  // stateهای مشترک
  const [form, setForm] = useState(emptyForm);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // stateهای تاریخچه
  const [historyFilter, setHistoryFilter] = useState("همه");
  const [historySearch, setHistorySearch] = useState("");

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };
  const result = fromAFN(Math.max(toAFN(Number(form.amount || 0), form.payCur, rates) - Number(form.fee || 0), 0), form.getCur, rates);

  // فیلتر حواله‌ها بر اساس وضعیت
  const pendingList = list.filter(h => h.status === "در انتظار");
  const sentList = list.filter(h => h.status === "ارسال شده");
  const deliveredList = list.filter(h => h.status === "تحویل شده");

  // محاسبه آمار برای گزارشات
  const stats = useMemo(() => {
    let totalAmount = 0, totalFee = 0, totalResult = 0;
    const cities: Record<string, number> = {};
    const customers: Record<string, { count: number; volume: number; type: string }> = {};

    list.forEach(h => {
      totalAmount += Number(h.amount || 0);
      totalFee += Number(h.fee || 0);
      totalResult += Number(h.result || 0);
      cities[`${h.fromCity} ← ${h.toCity}`] = (cities[`${h.fromCity} ← ${h.toCity}`] || 0) + 1;
      if (h.sender) {
        customers[h.sender] = {
          count: (customers[h.sender]?.count || 0) + 1,
          volume: (customers[h.sender]?.volume || 0) + Number(h.amount || 0),
          type: "فرستنده",
        };
      }
      if (h.receiver) {
        customers[h.receiver] = {
          count: (customers[h.receiver]?.count || 0) + 1,
          volume: (customers[h.receiver]?.volume || 0) + Number(h.result || 0),
          type: "گیرنده",
        };
      }
    });

    return { totalAmount, totalFee, totalResult, cities, customers };
  }, [list]);

  const add = () => {
    const m = checkRequired(form, [
      { key: "sender", label: "نام فرستنده" },
      { key: "receiver", label: "نام گیرنده" },
      { key: "amount", label: "مبلغ" },
    ]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    setList([{ id: Date.now(), ...form, result: result.toFixed(0), date: todayFa(), status: "در انتظار" }, ...list]);
    setForm({ ...emptyForm });
    setSuccess("✅ حواله با موفقیت ثبت شد");
    setTimeout(() => setSuccess(""), 3000);
  };

  const updateStatus = (id: number, status: string) => {
    setList(list.map(h => h.id === id ? { ...h, status } : h));
    setSuccess(`✅ وضعیت به «${status}» تغییر کرد`);
    setTimeout(() => setSuccess(""), 2000);
  };

  const wa = (h: Hawala) => {
    const msg = encodeURIComponent(`صرافی برادران نورزاد هرات\nحواله از ${h.fromCity} به ${h.toCity}\nگیرنده: ${h.receiver}\nمبلغ قابل دریافت: ${fa(Number(h.result))} ${h.getCur}\nفرستنده: ${h.sender}`);
    return `https://wa.me/${h.phone}?text=${msg}`;
  };

  const filteredHistory = list.filter(h => {
    const matchStatus = historyFilter === "همه" || h.status === historyFilter;
    const matchSearch = h.sender.includes(historySearch) || h.receiver.includes(historySearch);
    return matchStatus && matchSearch;
  });

  const subTabs = [
    { id: "register", label: "ثبت حواله", icon: "📝" },
    { id: "pending", label: "حواله‌های در انتظار", icon: "⏳" },
    { id: "receive", label: "دریافت/پرداخت", icon: "💸" },
    { id: "history", label: "تاریخچه", icon: "📚" },
    { id: "reports", label: "گزارشات", icon: "📊" },
    { id: "customers", label: "مشتریان", icon: "👥" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold flex items-center gap-2">💸 حواله‌جات</h1>

      {/* نوار زیربخش‌ها */}
      <div className="card p-2 flex gap-1 overflow-x-auto sticky top-0 z-10 bg-[#f6f4ee]">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              subTab === tab.id
                ? "bg-[#0b1f2e] text-[#e3b45c] shadow-md"
                : "text-slate-600 hover:bg-white"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {success && (
        <div className="text-sm rounded-xl p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
          {success}
        </div>
      )}

      {/* ================================================================ */}
      {/* 📝 بخش ۱: ثبت حواله */}
      {/* ================================================================ */}
      {subTab === "register" && (
        <div className="space-y-6">
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
        </div>
      )}

      {/* ================================================================ */}
      {/* ⏳ بخش ۲: حواله‌های در انتظار */}
      {/* ================================================================ */}
      {subTab === "pending" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">حواله‌های در انتظار ارسال</h2>
            <span className="text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
              {pendingList.length} حواله
            </span>
          </div>

          {pendingList.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              هیچ حواله‌ای در انتظار ارسال نیست 🎉
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0b1f2e] text-[#e3b45c]">
                  <tr>
                    <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
                    <th className="text-right px-4 py-3 font-bold">فرستنده</th>
                    <th className="text-right px-4 py-3 font-bold">گیرنده</th>
                    <th className="text-right px-4 py-3 font-bold">مسیر</th>
                    <th className="text-right px-4 py-3 font-bold">مبلغ</th>
                    <th className="text-right px-4 py-3 font-bold">دریافتی</th>
                    <th className="text-right px-4 py-3 font-bold">تاریخ</th>
                    <th className="text-right px-4 py-3 font-bold">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingList.map((h, index) => (
                    <tr key={h.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
                        {(index + 1).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3 font-bold">{h.sender}</td>
                      <td className="px-4 py-3">{h.receiver}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{h.fromCity} ← {h.toCity}</td>
                      <td className="px-4 py-3">{fa(Number(h.amount))} {h.payCur}</td>
                      <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(h.result))} {h.getCur}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{h.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                            onClick={() => updateStatus(h.id, "ارسال شده")}
                          >
                            📤 ارسال
                          </button>
                          <a href={wa(h)} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100">
                            واتساپ
                          </a>
                        </div>
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
      {/* 💸 بخش ۳: دریافت/پرداخت */}
      {/* ================================================================ */}
      {subTab === "receive" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">دریافت و پرداخت حواله‌ها</h2>
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
              {sentList.length} در انتظار پرداخت
            </span>
          </div>

          {sentList.length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              هیچ حواله‌ای در انتظار پرداخت نیست ✅
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0b1f2e] text-[#e3b45c]">
                  <tr>
                    <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
                    <th className="text-right px-4 py-3 font-bold">گیرنده</th>
                    <th className="text-right px-4 py-3 font-bold">شهر مقصد</th>
                    <th className="text-right px-4 py-3 font-bold">مبلغ پرداختی</th>
                    <th className="text-right px-4 py-3 font-bold">ارز</th>
                    <th className="text-right px-4 py-3 font-bold">تاریخ</th>
                    <th className="text-right px-4 py-3 font-bold">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sentList.map((h, index) => (
                    <tr key={h.id} className="hover:bg-blue-50/40">
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
                        {(index + 1).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3 font-bold">{h.receiver}</td>
                      <td className="px-4 py-3">{h.toCity}</td>
                      <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(h.result))}</td>
                      <td className="px-4 py-3">{h.getCur}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{h.date}</td>
                      <td className="px-4 py-3">
                        <button
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                          onClick={() => updateStatus(h.id, "تحویل شده")}
                        >
                          ✅ تأیید پرداخت
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* خلاصه پرداخت‌های امروز */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="card p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
              <p className="text-xs text-amber-700 font-bold mb-1">⏳ در انتظار</p>
              <p className="text-2xl font-extrabold text-amber-700">{pendingList.length}</p>
            </div>
            <div className="card p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
              <p className="text-xs text-blue-700 font-bold mb-1">📤 ارسال شده</p>
              <p className="text-2xl font-extrabold text-blue-700">{sentList.length}</p>
            </div>
            <div className="card p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
              <p className="text-xs text-emerald-700 font-bold mb-1">✅ تحویل شده</p>
              <p className="text-2xl font-extrabold text-emerald-700">{deliveredList.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 📚 بخش ۴: تاریخچه */}
      {/* ================================================================ */}
      {subTab === "history" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">تاریخچه حواله‌ها</h2>
            <div className="flex gap-2">
              <select
                className="input !w-auto text-sm"
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
              >
                <option>همه</option>
                <option>در انتظار</option>
                <option>ارسال شده</option>
                <option>تحویل شده</option>
              </select>
              <input
                className="input !w-auto text-sm"
                placeholder="جستجوی فرستنده یا گیرنده..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0b1f2e] text-[#e3b45c]">
                <tr>
                  <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
                  <th className="text-right px-4 py-3 font-bold">فرستنده</th>
                  <th className="text-right px-4 py-3 font-bold">گیرنده</th>
                  <th className="text-right px-4 py-3 font-bold">مسیر</th>
                  <th className="text-right px-4 py-3 font-bold">مبلغ</th>
                  <th className="text-right px-4 py-3 font-bold">دریافتی</th>
                  <th className="text-right px-4 py-3 font-bold">وضعیت</th>
                  <th className="text-right px-4 py-3 font-bold">تاریخ</th>
                  <th className="text-right px-4 py-3 font-bold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">حواله‌ای یافت نشد</td></tr>
                ) : (
                  filteredHistory.map((h, index) => (
                    <tr key={h.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
                        {(index + 1).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3 font-bold">{h.sender}</td>
                      <td className="px-4 py-3">{h.receiver}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{h.fromCity} ← {h.toCity}</td>
                      <td className="px-4 py-3">{fa(Number(h.amount))} {h.payCur}</td>
                      <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(Number(h.result))} {h.getCur}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full border ${statusChipClass(h.status)}`}>{h.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{h.date}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <a href={wa(h)} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100">واتساپ</a>
                          <button className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100" onClick={() => setList(list.filter(x => x.id !== h.id))}>حذف</button>
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
      {/* 📊 بخش ۵: گزارشات */}
      {/* ================================================================ */}
      {subTab === "reports" && (
        <div className="space-y-6">
          <h2 className="text-lg font-extrabold">گزارشات حواله‌جات</h2>

          {/* کارت‌های آمار کلی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 bg-gradient-to-br from-sky-500 to-blue-600 text-white">
              <p className="text-xs opacity-80 font-bold">📊 مجموع حواله‌ها</p>
              <p className="text-2xl font-extrabold mt-2">{fa(list.length)}</p>
              <p className="text-[11px] opacity-70 mt-1">از ابتدای ثبت</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <p className="text-xs opacity-80 font-bold">💰 حجم کل</p>
              <p className="text-2xl font-extrabold mt-2">{fa(stats.totalAmount)}</p>
              <p className="text-[11px] opacity-70 mt-1">مجموع مبالغ ارسالی</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <p className="text-xs opacity-80 font-bold">💎 مجموع کارمزد</p>
              <p className="text-2xl font-extrabold mt-2">{fa(stats.totalFee)}</p>
              <p className="text-[11px] opacity-70 mt-1">افغانی</p>
            </div>
            <div className="card p-5 bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white">
              <p className="text-xs opacity-80 font-bold">🎯 تحویل شده</p>
              <p className="text-2xl font-extrabold mt-2">{fa(deliveredList.length)}</p>
              <p className="text-[11px] opacity-70 mt-1">از {fa(list.length)} حواله</p>
            </div>
          </div>

          {/* وضعیت حواله‌ها */}
          <div className="card p-5">
            <h3 className="font-bold mb-4">وضعیت حواله‌ها</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-2xl font-extrabold text-amber-700">{fa(pendingList.length)}</p>
                <p className="text-xs text-amber-600 font-bold mt-1">⏳ در انتظار</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-2xl font-extrabold text-blue-700">{fa(sentList.length)}</p>
                <p className="text-xs text-blue-600 font-bold mt-1">📤 ارسال شده</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-2xl font-extrabold text-emerald-700">{fa(deliveredList.length)}</p>
                <p className="text-xs text-emerald-600 font-bold mt-1">✅ تحویل شده</p>
              </div>
            </div>
          </div>

          {/* برترین مسیرها */}
          <div className="card p-5">
            <h3 className="font-bold mb-4">برترین مسیرهای حواله</h3>
            {Object.keys(stats.cities).length === 0 ? (
              <p className="text-center text-slate-400 py-4">هنوز حواله‌ای ثبت نشده</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(stats.cities)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([route, count], i) => (
                    <div key={route} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-bold text-sm">
                          {(i + 1).toLocaleString("en-US")}
                        </span>
                        <span className="font-bold text-sm">{route}</span>
                      </div>
                      <span className="text-xs bg-slate-200 px-2 py-1 rounded-full font-bold">{fa(count)} حواله</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 👥 بخش ۶: مشتریان */}
      {/* ================================================================ */}
      {subTab === "customers" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">مشتریان حواله‌جات</h2>
            <span className="text-sm bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">
              {Object.keys(stats.customers).length} مشتری
            </span>
          </div>

          {Object.keys(stats.customers).length === 0 ? (
            <div className="card p-8 text-center text-slate-400">
              هنوز مشتری‌ای ثبت نشده است
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0b1f2e] text-[#e3b45c]">
                  <tr>
                    <th className="text-center px-4 py-3 font-bold w-20">شماره</th>
                    <th className="text-right px-4 py-3 font-bold">نام</th>
                    <th className="text-right px-4 py-3 font-bold">نوع</th>
                    <th className="text-right px-4 py-3 font-bold">تعداد حواله</th>
                    <th className="text-right px-4 py-3 font-bold">حجم کل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(stats.customers)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([name, info], index) => (
                      <tr key={name} className="hover:bg-amber-50/40">
                        <td className="px-4 py-3 text-center font-mono font-bold text-[#0b1f2e]">
                          {(index + 1).toLocaleString("en-US")}
                        </td>
                        <td className="px-4 py-3 font-bold">{name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${
                            info.type === "فرستنده"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {info.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">{fa(info.count)} حواله</td>
                        <td className="px-4 py-3 font-bold text-[#c98f2d]">{fa(info.volume)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
