"use client";

import { useState } from "react";
import { useStored, Field, ErrorBox, Modal, ShareBar } from "../lib/ui";
import { fa, checkRequired, requiredMessage, statusChipClass, CURRENCY_META } from "../lib/helpers";
import type { AccountUser } from "../lib/helpers";

const empty = { name: "", phone: "", AFN: "", USD: "", IRR: "" };

// اگر کاربر قدیمی (بدون balances) بود، خودکار به ساختار جدید تبدیل می‌کند
const norm = (u: any): AccountUser => ({
  id: u.id,
  name: u.name || "",
  phone: u.phone || "",
  status: u.status || "فعال",
  balances: u.balances || { AFN: Number(u.balance || 0), USD: 0, IRR: 0 },
});

export default function UsersPage() {
  const [raw, setRaw] = useStored<AccountUser[]>("db_users", [
    { id: 1, name: "احمد", phone: "93700000000", balances: { AFN: 300000, USD: 1200, IRR: 85000000 }, status: "فعال" },
  ]);
  const users = raw.map(norm);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [shareUser, setShareUser] = useState<AccountUser | null>(null);

  const set = (patch: any) => { setForm({ ...form, ...patch }); setMissing([]); setError(""); };

  const save = () => {
    const m = checkRequired(form, [{ key: "name", label: "نام" }, { key: "phone", label: "شماره تماس" }]);
    if (m.length) { setMissing(m); setError(requiredMessage(m)); return; }
    const balances = { AFN: Number(form.AFN || 0), USD: Number(form.USD || 0), IRR: Number(form.IRR || 0) };
    if (editId) {
      setRaw(raw.map(u => u.id === editId ? { ...norm(u), name: form.name, phone: form.phone, balances } : u));
    } else {
      setRaw([...raw, { id: Date.now(), name: form.name, phone: form.phone, balances, status: "فعال" }]);
    }
    setModal(false); setForm(empty); setEditId(null);
  };

  const filtered = users.filter(u => u.name.includes(search) || u.phone.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">مشتریان و حساب‌ها</h1>
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
              <th className="text-right px-4 py-3 font-bold">🇦🇫 افغانی</th>
              <th className="text-right px-4 py-3 font-bold">🇺🇸 دالر</th>
              <th className="text-right px-4 py-3 font-bold">🇮🇷 تومان</th>
              <th className="text-right px-4 py-3 font-bold">وضعیت</th>
              <th className="text-right px-4 py-3 font-bold">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-amber-50/40">
                <td className="px-4 py-3 font-bold">{u.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.phone}</td>
                <td className="px-4 py-3">{fa(u.balances.AFN)}</td>
                <td className="px-4 py-3">{fa(u.balances.USD)}</td>
                <td className="px-4 py-3">{fa(u.balances.IRR)}</td>
                <td className="px-4 py-3"><span className={`text-xs px-3 py-1 rounded-full border ${statusChipClass(u.status)}`}>{u.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100" onClick={() => setShareUser(u)}>اشتراک</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => { setEditId(u.id); setForm({ name: u.name, phone: u.phone, AFN: String(u.balances.AFN), USD: String(u.balances.USD), IRR: String(u.balances.IRR) }); setMissing([]); setError(""); setModal(true); }}>ویرایش</button>
                    <button className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" onClick={() => setRaw(raw.filter(x => x.id !== u.id))}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editId ? "ویرایش حساب مشتری" : "مشتری جدید"} onClose={() => setModal(false)}>
          <div className="space-y-3">
            <Field label="نام" name="نام" missing={missing} value={form.name} onChange={v => set({ name: v })} />
            <Field label="شماره تماس" name="شماره تماس" missing={missing} value={form.phone} onChange={v => set({ phone: v })} />
            <div className="grid grid-cols-3 gap-3">
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
            text={`مشتری: ${shareUser.name}\nشماره: ${shareUser.phone}\nمانده افغانی: ${fa(shareUser.balances.AFN)}\nمانده دالر: ${fa(shareUser.balances.USD)}\nمانده تومان: ${fa(shareUser.balances.IRR)}\nوضعیت: ${shareUser.status}`}
            phone={shareUser.phone}
            pdfTitle="صورت حساب مشتری"
            pdfRows={[
              { label: "نام", value: shareUser.name },
              { label: "شماره", value: shareUser.phone },
              { label: "افغانی", value: fa(shareUser.balances.AFN) },
              { label: "دالر", value: fa(shareUser.balances.USD) },
              { label: "تومان", value: fa(shareUser.balances.IRR) },
            ]}
          />
          <button className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-bold" onClick={() => setShareUser(null)}>بستن</button>
        </Modal>
      )}
    </div>
  );
}
