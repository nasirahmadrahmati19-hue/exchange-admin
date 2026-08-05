"use client";

import { useState } from "react";
import { useStored, Field, ErrorBox, Modal, ShareBar } from "../lib/ui";
import { fa, checkRequired, requiredMessage, statusChipClass } from "../lib/helpers";

interface User { id: number; name: string; email: string; phone: string; balance: string; status: string; }
const empty = { name: "", email: "", phone: "", balance: "" };

export default function UsersPage() {
  const [users, setUsers] = useStored<User[]>("db_users", [
    { id: 1, name: "علی محمدی", email: "ali@mail.com", phone: "09121234567", balance: "12500", status: "فعال" },
  ]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [shareUser, setShareUser] = useState<User | null>(null);

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };

  const save = () => {
    const m = checkRequired(form, [{ key: "name", label: "نام" }, { key: "phone", label: "شماره تماس" }]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    if (editId) setUsers(users.map(u => u.id === editId ? { ...u, ...form } : u));
    else setUsers([...users, { id: Date.now(), ...form, status: "فعال" }]);
    setModal(false); setForm(empty); setEditId(null);
  };

  const filtered = users.filter(u => u.name.includes(search) || u.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">مشتریان</h1>
        <button className="btn-gold" onClick={() => { setForm(empty); setEditId(null); setMissing([]); setError(""); setModal(true); }}>+ افزودن مشتری</button>
      </div>

      <div className="max-w-sm">
        <label className="block text-sm font-bold mb-2">جستجوی مشتری</label>
        <input className="input" placeholder="نام یا شماره..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1f2e] text-[#e3b45c]">
            <tr>
              <th className="text-right px-4 py-3 font-bold">نام</th>
              <th className="text-right px-4 py-3 font-bold">تماس</th>
              <th className="text-right px-4 py-3 font-bold">موجودی</th>
              <th className="text-right px-4 py-3 font-bold">وضعیت</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold">{u.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.phone}</td>
                <td className="px-4 py-3">{fa(Number(u.balance || 0))}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(u.status)}`}>{u.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100" onClick={() => setShareUser(u)}>اشتراک</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => { setEditId(u.id); setForm({ name: u.name, email: u.email, phone: u.phone, balance: u.balance }); setMissing([]); setError(""); setModal(true); }}>ویرایش</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setUsers(users.filter(x => x.id !== u.id))}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editId ? "ویرایش مشتری" : "مشتری جدید"} onClose={() => setModal(false)}>
          <div className="space-y-3">
            <Field label="نام" name="نام" missing={missing} value={form.name} onChange={v => set({ name: v })} />
            <Field label="شماره تماس" name="شماره تماس" missing={missing} value={form.phone} onChange={v => set({ phone: v })} />
            <Field label="ایمیل (اختیاری)" value={form.email} onChange={v => set({ email: v })} />
            <Field label="موجودی (اختیاری)" value={form.balance} onChange={v => set({ balance: v })} />
            <ErrorBox error={error} />
          </div>
          <div className="flex gap-2 mt-5">
            <button className="btn-gold flex-1" onClick={save}>ذخیره</button>
            <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold" onClick={() => setModal(false)}>انصراف</button>
          </div>
        </Modal>
      )}

      {shareUser && (
        <Modal title="اشتراک‌گذاری مشخصات مشتری" onClose={() => setShareUser(null)}>
          <div className="text-sm space-y-1 mb-4 bg-slate-50 rounded-xl p-4">
            <p><b>نام:</b> {shareUser.name}</p>
            <p><b>شماره:</b> {shareUser.phone}</p>
            <p><b>موجودی:</b> {fa(Number(shareUser.balance || 0))}</p>
            <p><b>وضعیت:</b> {shareUser.status}</p>
          </div>
          <ShareBar
            text={`مشتری: ${shareUser.name}\nشماره: ${shareUser.phone}\nایمیل: ${shareUser.email}\nموجودی: ${fa(Number(shareUser.balance || 0))}\nوضعیت: ${shareUser.status}`}
            phone={shareUser.phone}
            pdfTitle="مشخصات مشتری"
            pdfRows={[
              { label: "نام", value: shareUser.name },
              { label: "شماره تماس", value: shareUser.phone },
              { label: "ایمیل", value: shareUser.email },
              { label: "موجودی", value: fa(Number(shareUser.balance || 0)) },
              { label: "وضعیت", value: shareUser.status },
            ]}
          />
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setShareUser(null)}>بستن</button>
        </Modal>
      )}
    </div>
  );
}
