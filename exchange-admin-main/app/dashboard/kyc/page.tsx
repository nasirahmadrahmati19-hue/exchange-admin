"use client";

import { useEffect, useState } from "react";

interface Req { id: number; user: string; doc: string; date: string; status: string; }

const defaults: Req[] = [
  { id: 1, user: "علی محمدی", doc: "کارت ملی", date: "۱۴۰۵/۰۵/۱۰", status: "در انتظار" },
  { id: 2, user: "سارا احمدی", doc: "پاسپورت", date: "۱۴۰۵/۰۵/۱۲", status: "در انتظار" },
];

export default function KYCPage() {
  const [reqs, setReqs] = useState<Req[]>(defaults);
  const [confirm, setConfirm] = useState<{ id: number; action: string } | null>(null);

  useEffect(() => { const s = localStorage.getItem("db_kyc"); if (s) setReqs(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("db_kyc", JSON.stringify(reqs)); }, [reqs]);

  const act = (status: string) => {
    if (!confirm) return;
    setReqs(reqs.map(r => r.id === confirm.id ? { ...r, status } : r));
    setConfirm(null);
  };

  const chip: Record<string, string> = {
    "در انتظار": "bg-amber-50 text-amber-700 border-amber-200",
    "تأیید شده": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "رد شده": "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">درخواست‌های احراز هویت</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-5 py-3 font-bold">کاربر</th>
              <th className="text-right px-5 py-3 font-bold">مدرک</th>
              <th className="text-right px-5 py-3 font-bold">تاریخ</th>
              <th className="text-right px-5 py-3 font-bold">وضعیت</th>
              <th className="text-right px-5 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reqs.map(r => (
              <tr key={r.id} className="hover:bg-amber-50/40">
                <td className="px-5 py-3 font-bold">{r.user}</td>
                <td className="px-5 py-3">{r.doc}</td>
                <td className="px-5 py-3 text-slate-500">{r.date}</td>
                <td className="px-5 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${chip[r.status]}`}>{r.status}</span></td>
                <td className="px-5 py-3">
                  {r.status === "در انتظار" ? (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700" onClick={() => setConfirm({ id: r.id, action: "تأیید شده" })}>تأیید</button>
                      <button className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700" onClick={() => setConfirm({ id: r.id, action: "رد شده" })}>رد</button>
                    </div>
                  ) : (
                    <button className="text-xs text-slate-500 hover:text-[#0b1f2e] underline" onClick={() => setReqs(reqs.map(x => x.id === r.id ? { ...x, status: "در انتظار" } : x))}>برگشت به انتظار</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 text-center fade-up">
            <p className="font-bold mb-5">این درخواست «{confirm.action}» شود؟</p>
            <div className="flex gap-2">
              <button className={`flex-1 rounded-xl text-white py-2.5 text-sm font-bold ${confirm.action === "تأیید شده" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`} onClick={() => act(confirm.action)}>تأیید</button>
              <button className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold hover:bg-slate-50" onClick={() => setConfirm(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
