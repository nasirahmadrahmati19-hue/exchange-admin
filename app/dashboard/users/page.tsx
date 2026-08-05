"use client";

import { useEffect, useState } from "react";

interface User {
  id: number; name: string; email: string; phone: string; balance: string; status: string;
}

const empty = { name: "", email: "", phone: "", balance: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = localStorage.getItem("db_users");
    if (s) {
      try { setUsers(JSON.parse(s)); } catch {}
    } else {
      setUsers([
        { id: 1, name: "علی محمدی", email: "ali@mail.com", phone: "09121234567", balance: "12500", status: "فعال" },
        { id: 2, name: "سارا احمدی", email: "sara@mail.com", phone: "09129876543", balance: "8200", status: "فعال" },
      ]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("db_users", JSON.stringify(users));
  }, [users]);

  const update = (patch: any) => {
    setForm({ ...form, ...patch });
    setMissing([]);
    setError("");
  };

  const fc = (name: string) => `input ${missing.includes(name) ? "!border-red-500" : ""}`;

  const save = () => {
    const m: string[] = [];
    if (!form.name.trim()) m.push("نام");
    if (!form.phone.trim()) m.push("شماره تماس");
    if (m.length > 0) {
      setMissing(m);
      setError("لطفاً این فیلدها را پر کنید: " + m.join("، "));
      return;
    }
    setMissing([]);
    setError("");
    if (editId) {
      setUsers(users.map(u => u.id === editId ? { ...u, ...form } : u));
    } else {
      setUsers([...users, { id: Date.now(), ...form, status: "فعال" }]);
    }
    setModal(false);
    setForm(empty);
    setEditId(null);
  };

  const filtered = users.filter(u => u.name.includes(search) || u.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">مشتریان</h1>
        <button className="btn-gold" onClick={() => { setForm(empty); setEditId(null); setMissing([]); setError(""); setModal(true); }}>
          + افزودن مشتری
        </button>
      </div>

      <div className="max-w-sm">
        <label className="block text-sm font-bold mb-2">جستجوی مشتری</label>
        <input className="input" placeholder="نام یا شماره..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-5 py-3 font-bold">نام</th>
              <th className="text-right px-5 py-3 font-bold">تماس</th>
              <th className="text-right px-5 py-3 font-bold">موجودی</th>
              <th className="text-right px-5 py-3 font-bold">وضعیت</th>
              <th className="text-right px-5 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-amber-50/40">
                <td className="px-5 py-3 font-bold">{u.name}</td>
                <td className="px-5 py-3 text-slate-500 text-xs">{u.phone}</td>
                <td className="px-5 py-3">{Number(u.balance || 0).toLocaleString("fa-IR")}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-3 py-1 rounded-full border ${u.status === "فعال" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{u.status}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => { setEditId(u.id); setForm({ name: u.name, email: u.email, phone: u.phone, balance: u.balance }); setMissing([]); setError(""); setModal(true); }}>ویرایش</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100" onClick={() => setUsers(users.map(x => x.id === u.id ? { ...x, status: x.status === "فعال" ? "مسدود" : "فعال" } : x))}>{u.status === "فعال" ? "مسدود" : "فعال‌سازی"}</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setUsers(users.filter(x => x.id !== u.id))}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="font-extrabold mb-5">{editId ? "ویرایش مشتری" : "مشتری جدید"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold mb-2">نام</label>
                <input className={fc("نام")} placeholder="نام و نام خانوادگی" value={form.name} onChange={e => update({ name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">شماره تماس</label>
                <input className={fc("شماره تماس")} placeholder="09..." value={form.phone} onChange={e => update({ phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">ایمیل (اختیاری)</label>
                <input className="input" placeholder="example@mail.com" value={form.email} onChange={e => update({ email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">موجودی (اختیاری)</label>
                <input className="input" placeholder="0" value={form.balance} onChange={e => update({ balance: e.target.value })} />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">{error}</div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-gold flex-1" onClick={save}>ذخیره</button>
              <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold" onClick={() => setModal(false)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
