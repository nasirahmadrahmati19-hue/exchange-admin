"use client";

import { useEffect, useState } from "react";

interface User { id: number; name: string; email: string; phone: string; balance: string; status: string; }

const defaults: User[] = [
  { id: 1, name: "علی محمدی", email: "ali@mail.com", phone: "09121234567", balance: "12500", status: "فعال" },
  { id: 2, name: "سارا احمدی", email: "sara@mail.com", phone: "09129876543", balance: "8200", status: "فعال" },
];

function Icon({ d, className = "w-4 h-4" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {d.split("|").map((p, i) => (<path key={i} d={p} />))}
    </svg>
  );
}

const empty = { name: "", email: "", phone: "", balance: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(defaults);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const s = localStorage.getItem("db_users");
    if (s) setUsers(JSON.parse(s));
  }, []);

  useEffect(() => {
    localStorage.setItem("db_users", JSON.stringify(users));
  }, [users]);

  const save = () => {
    if (!form.name) return;
    if (editId) {
      setUsers(users.map(u => u.id === editId ? { ...u, ...form } : u));
    } else {
      setUsers([...users, { id: Date.now(), ...form, status: "فعال" }]);
    }
    setModal(false); setForm(empty); setEditId(null);
  };

  const filtered = users.filter(u => u.name.includes(search) || u.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">مدیریت کاربران</h1>
        <button className="btn-gold" onClick={() => { setForm(empty); setEditId(null); setModal(true); }}>
          <Icon d="M12 5v14|M5 12h14" /> افزودن کاربر
        </button>
      </div>

      <div className="relative max-w-sm">
        <input className="input pr-10" placeholder="جستجوی نام یا شماره..." value={search} onChange={e => setSearch(e.target.value)} />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.35-4.35" />
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-5 py-3 font-bold">نام</th>
              <th className="text-right px-5 py-3 font-bold">تماس</th>
              <th className="text-right px-5 py-3 font-bold">موجودی (دلار)</th>
              <th className="text-right px-5 py-3 font-bold">وضعیت</th>
              <th className="text-right px-5 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-amber-50/40 transition-colors">
                <td className="px-5 py-3 font-bold">{u.name}</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{u.phone}<br />{u.email}</td>
                <td className="px-5 py-3">{Number(u.balance || 0).toLocaleString("fa-IR")}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-3 py-1 rounded-full border ${u.status === "فعال" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{u.status}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <button title="ویرایش" className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" onClick={() => { setEditId(u.id); setForm({ name: u.name, email: u.email, phone: u.phone, balance: u.balance }); setModal(true); }}>
                      <Icon d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </button>
                    <button title={u.status === "فعال" ? "مسدود" : "فعال‌سازی"} className={`p-2 rounded-lg ${u.status === "فعال" ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`} onClick={() => setUsers(users.map(x => x.id === u.id ? { ...x, status: x.status === "فعال" ? "مسدود" : "فعال" } : x))}>
                      <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </button>
                    <button title="حذف" className="p-2 rounded-lg text-red-600 hover:bg-red-50" onClick={() => setDeleteId(u.id)}>
                      <Icon d="M3 6h18|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2|M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 fade-up">
            <h2 className="font-extrabold mb-5">{editId ? "ویرایش کاربر" : "کاربر جدید"}</h2>
            <div className="space-y-3">
              <input className="input" placeholder="نام و نام خانوادگی" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="شماره تماس" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="ایمیل" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="موجودی (دلار)" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-gold flex-1" onClick={save}>ذخیره</button>
              <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50" onClick={() => setModal(false)}>انصراف</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 text-center fade-up">
            <p className="font-bold mb-5">این کاربر برای همیشه حذف شود؟</p>
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-red-600 text-white py-2.5 text-sm font-bold hover:bg-red-700" onClick={() => { setUsers(users.filter(u => u.id !== deleteId)); setDeleteId(null); }}>بله، حذف شود</button>
              <button className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold hover:bg-slate-50" onClick={() => setDeleteId(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
