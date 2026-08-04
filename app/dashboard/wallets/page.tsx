"use client";

import { useEffect, useState } from "react";

interface Wallet { id: number; currency: string; balance: string; address: string; }

const defaults: Wallet[] = [
  { id: 1, currency: "BTC", balance: "1.2045", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
  { id: 2, currency: "USDT", balance: "45230", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9" },
];

export default function WalletsPage() {
  const [wallets, setWallets] = useState<Wallet[]>(defaults);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ currency: "", balance: "", address: "" });
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => { const s = localStorage.getItem("db_wallets"); if (s) setWallets(JSON.parse(s)); }, []);
  useEffect(() => { localStorage.setItem("db_wallets", JSON.stringify(wallets)); }, [wallets]);

  const save = () => {
    if (!form.currency) return;
    if (editId) setWallets(wallets.map(w => w.id === editId ? { ...w, ...form } : w));
    else setWallets([...wallets, { id: Date.now(), ...form }]);
    setModal(false); setForm({ currency: "", balance: "", address: "" }); setEditId(null);
  };

  const copy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">کیف پول‌های صرافی</h1>
        <button className="btn-gold" onClick={() => { setForm({ currency: "", balance: "", address: "" }); setEditId(null); setModal(true); }}>+ کیف پول جدید</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {wallets.map(w => (
          <div key={w.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-extrabold">{w.currency}</div>
                <div>
                  <p className="font-extrabold">{Number(w.balance || 0).toLocaleString("fa-IR")}</p>
                  <p className="text-xs text-slate-500">موجودی</p>
                </div>
              </div>
              <button className="text-xs text-blue-600 underline" onClick={() => { setEditId(w.id); setForm({ currency: w.currency, balance: w.balance, address: w.address }); setModal(true); }}>ویرایش</button>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
              <code className="text-[10px] text-slate-500 truncate flex-1" dir="ltr">{w.address}</code>
              <button className="text-xs font-bold text-[#0b1f2e] bg-[#e8c06a] px-3 py-1.5 rounded-lg hover:brightness-105" onClick={() => copy(w.id, w.address)}>
                {copied === w.id ? "✔ کپی شد" : "کپی"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 fade-up">
            <h2 className="font-extrabold mb-5">{editId ? "ویرایش کیف پول" : "کیف پول جدید"}</h2>
            <div className="space-y-3">
              <input className="input" placeholder="نماد ارز (مثلاً BTC)" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
              <input className="input" placeholder="موجودی" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} />
              <input className="input" placeholder="آدرس کیف پول" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-gold flex-1" onClick={save}>ذخیره</button>
              <button className="flex-1 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50" onClick={() => setModal(false)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
