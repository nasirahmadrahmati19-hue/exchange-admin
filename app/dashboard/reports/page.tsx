"use client";

import { useEffect, useState } from "react";

interface Ticket {
  id: number; user: string; subject: string; date: string; status: string; reply: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [replyId, setReplyId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const s = localStorage.getItem("db_tickets");
    if (s) {
      try { setTickets(JSON.parse(s)); } catch {}
    } else {
      setTickets([
        { id: 1, user: "علی محمدی", subject: "مشکل در برداشت", date: "۱۴۰/۰۵/۲", status: "باز", reply: "" },
        { id: 2, user: "سارا احمدی", subject: "تغییر رمز عبور", date: "۱۴۰/۰۵/۰", status: "بسته", reply: "رمز شما بازنشانی شد." },
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("db_tickets", JSON.stringify(tickets));
  }, [tickets]);

  const send = () => {
    if (!text.trim()) {
      setError("لطفاً متن پاسخ را بنویسید");
      return;
    }
    setError("");
    setTickets(tickets.map(t => t.id === replyId ? { ...t, reply: text, status: "بسته" } : t));
    setReplyId(null);
    setText("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">تیکت‌های پشتیبانی</h1>
      <div className="space-y-4">
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
            {t.reply && (
              <div className="mt-4 bg-amber-50/60 border border-amber-100 rounded-xl p-4 text-sm">{t.reply}</div>
            )}
          </div>
        ))}
      </div>

      {replyId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-extrabold mb-4">پاسخ به تیکت</h2>
            <label className="block text-sm font-bold mb-2">متن پاسخ</label>
            <textarea
              className={`input min-h-[120px] ${error ? "!border-red-500" : ""}`}
              value={text}
              onChange={e => { setText(e.target.value); setError(""); }}
              placeholder="متن پاسخ..."
            />
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200 mt-3">{error}</div>
            )}
            <div className="flex gap-2 mt-4">
              <button className="btn-gold flex-1" onClick={send}>ارسال و بستن تیکت</button>
              <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold" onClick={() => setReplyId(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
