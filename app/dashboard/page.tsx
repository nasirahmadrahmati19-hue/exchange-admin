"use client";

import { useEffect, useState } from "react";

function Icon({ d, className = "w-5 h-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {d.split("|").map((p, i) => (<path key={i} d={p} />))}
    </svg>
  );
}

const read = (k: string) => {
  try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; }
};

const weeklyVolume = [
  { day: "شنبه", value: 65 }, { day: "یکشنبه", value: 80 }, { day: "دوشنبه", value: 45 },
  { day: "سه‌شنبه", value: 90 }, { day: "چهارشنبه", value: 70 }, { day: "پنجشنبه", value: 100 }, { day: "جمعه", value: 55 },
];

const statusStyle: Record<string, string> = {
  "در انتظار": "bg-amber-50 text-amber-700 border-amber-200",
  "تأیید شده": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "رد شده": "bg-red-50 text-red-700 border-red-200",
};

export default function DashboardPage() {
  const [stats, setStats] = useState([
    { title: "کل کاربران", value: "۰", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
    { title: "معاملات ثبت‌شده", value: "۰", icon: "M3 3v18h18|M7 15l4-6 3 4 5-7" },
    { title: "برداشت‌های در انتظار", value: "۰", icon: "M22 2 11 13|M22 2 15 22l-4-9-9-4 20-7z" },
    { title: "احراز هویت در انتظار", value: "۰", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  ]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const users = read("db_users");
    const trades = read("db_trades");
    const w = read("db_withdrawals");
    const kyc = read("db_kyc");
    const fa = (n: number) => n.toLocaleString("fa-IR");
    setStats([
      { ...stats[0], value: fa(users.length) },
      { ...stats[1], value: fa(trades.length) },
      { ...stats[2], value: fa(w.filter((x: any) => x.status === "در انتظار").length) },
      { ...stats[3], value: fa(kyc.filter((x: any) => x.status === "در انتظار").length) },
    ]);
    setWithdrawals(w.slice(0, 4));
  }, []);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-l from-[#0b1f2e] to-[#16374d] text-white p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-slate-900/20">
        <div>
          <p className="text-[#e3b45c] text-sm font-bold">خوش آمدید 🌟</p>
          <h2 className="text-xl font-extrabold mt-1">مدیریت صرافی برادران نورزاد</h2>
        </div>
        <a href="/dashboard/trades" className="btn-gold">+ معامله جدید</a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s) => (
          <div key={s.title} className="card p-5 flex items-center gap-4 hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center shrink-0">
              <Icon d={s.icon} className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">{s.title}</p>
              <p className="text-lg font-extrabold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-extrabold">حجم معاملات هفته</h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">میلیارد تومان</span>
          </div>
          <div className="flex items-end justify-between gap-2 h-48">
            {weeklyVolume.map((item, i) => (
              <div key={item.day} className="flex flex-col items-center gap-2 flex-1 group">
                <div
                  className={`w-full rounded-t-lg transition-all ${i === 5 ? "bg-gradient-to-t from-[#c98f2d] to-[#e8c06a] shadow-lg shadow-amber-500/30" : "bg-slate-200 group-hover:bg-[#e8c06a]/60"}`}
                  style={{ height: `${item.value}%` }}
                />
                <span className="text-[10px] text-slate-500">{item.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-extrabold mb-6">آخرین درخواست‌های برداشت</h3>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">درخواستی ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-bold text-sm">{w.user?.charAt(0)}</div>
                    <div>
                      <p className="font-bold text-sm">{w.user}</p>
                      <p className="text-xs text-slate-500">{w.amount} {w.currency}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full border ${statusStyle[w.status] || ""}`}>{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
