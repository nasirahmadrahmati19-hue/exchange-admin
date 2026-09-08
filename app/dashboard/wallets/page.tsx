"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";

// ==========================================================
// بخش ادغام‌شده‌ی useSyncedState (برای جلوگیری از خطای مسیر)
// ==========================================================
const channel = typeof window !== "undefined" ? new BroadcastChannel("exchange-app-sync-channel") : null;

function useSyncedState<T>(key: string, initialValue: T) {
  const latestState = useRef<T>(initialValue);

  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
        latestState.current = value;
        return value;
      }
      return initialValue;
    } catch (error) {
      console.warn(`[useSyncedState] خطا در خواندن "${key}".`, error);
      return initialValue;
    }
  });

  latestState.current = state;

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = JSON.parse(e.newValue);
          const value = parsed && typeof parsed === "object" && "value" in parsed ? parsed.value : parsed;
          if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
            setState(value);
          }
        } catch (error) {}
      }
    };

    const handleBroadcast = (event: MessageEvent) => {
      if (event.data.key === key && event.data.value !== undefined) {
        const value = event.data.value;
        if (JSON.stringify(latestState.current) !== JSON.stringify(value)) {
          setState(value);
        }
      }
    };

    const docRef = doc(db, "synced_states", key);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          const fbValue = data.value;
          if (fbValue !== undefined && JSON.stringify(latestState.current) !== JSON.stringify(fbValue)) {
            setState(fbValue);
            try {
              window.localStorage.setItem(key, JSON.stringify({ value: fbValue }));
            } catch (e) {
              console.warn("⚠️ حافظه مرورگر پر است.");
            }
          }
        }
      },
      (error) => {
        console.error(`[useSyncedState] ❌ خطای شنود فایربیس برای "${key}":`, error);
      }
    );

    window.addEventListener("storage", handleStorage);
    channel?.addEventListener("message", handleBroadcast);

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      unsubscribe();
    };
  }, [key]);

  const setSyncedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        if (typeof window !== "undefined") {
          try {
            const serialized = JSON.stringify({ value: newValue });
            window.localStorage.setItem(key, serialized);
            channel?.postMessage({ key, value: newValue });
            const docRef = doc(db, "synced_states", key);
            setDoc(docRef, { value: newValue }, { merge: true }).catch((err) => {
              console.error(`[useSyncedState] ❌ خطای نوشتن در فایربیس برای "${key}":`, err);
            });
          } catch (error) {
            console.error(`[useSyncedState] خطای کلی در ذخیره "${key}":`, error);
          }
        }
        return newValue;
      });
    },
    [key]
  );

  return [state, setSyncedState] as const;
}
// ==========================================================
// پایان بخش useSyncedState
// ==========================================================

interface Wallet { 
  id: number; 
  currency: string; 
  balance: string; 
  address: string; 
}

const defaults: Wallet[] = [
  { id: 1, currency: "BTC", balance: "1.2045", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
  { id: 2, currency: "USDT", balance: "45230", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9" },
];

export default function WalletsPage() {
  const [wallets, setWallets] = useSyncedState<Wallet[]>("db_wallets", defaults);
  
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ currency: "", balance: "", address: "" });
  const [copied, setCopied] = useState<number | null>(null);

  const save = () => {
    if (!form.currency) return;
    if (editId) {
      setWallets(wallets.map(w => w.id === editId ? { ...w, ...form } : w));
    } else {
      setWallets([...wallets, { id: Date.now(), ...form }]);
    }
    setModal(false); 
    setForm({ currency: "", balance: "", address: "" }); 
    setEditId(null);
  };

  const copy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDelete = (id: number) => {
    if (confirm("آیا از حذف این کیف پول اطمینان دارید؟")) {
      setWallets(wallets.filter(w => w.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">کیف پول‌های صرافی</h1>
        <button 
          className="btn-gold" 
          onClick={() => { 
            setForm({ currency: "", balance: "", address: "" }); 
            setEditId(null); 
            setModal(true); 
          }}
        >
          + کیف پول جدید
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {wallets.map(w => (
          <div key={w.id} className="card p-5 relative group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#0b1f2e] text-[#e3b45c] flex items-center justify-center font-extrabold">
                  {w.currency}
                </div>
                <div>
                  <p className="font-extrabold">{Number(w.balance || 0).toLocaleString("fa-IR")}</p>
                  <p className="text-xs text-slate-500">موجودی</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  className="text-xs text-blue-600 underline" 
                  onClick={() => { 
                    setEditId(w.id); 
                    setForm({ currency: w.currency, balance: w.balance, address: w.address }); 
                    setModal(true); 
                  }}
                >
                  ویرایش
                </button>
                <button 
                  className="text-xs text-red-600 underline" 
                  onClick={() => handleDelete(w.id)}
                >
                  حذف
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
              <code className="text-[10px] text-slate-500 truncate flex-1" dir="ltr">
                {w.address}
              </code>
              <button 
                className="text-xs font-bold text-[#0b1f2e] bg-[#e8c06a] px-3 py-1.5 rounded-lg hover:brightness-105" 
                onClick={() => copy(w.id, w.address)}
              >
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
              <input 
                className="input" 
                placeholder="نماد ارز (مثلاً USD, EUR, USDT)" 
                value={form.currency} 
                onChange={e => setForm({ ...form, currency: e.target.value })} 
              />
              <input 
                className="input" 
                placeholder="موجودی" 
                type="number"
                value={form.balance} 
                onChange={e => setForm({ ...form, balance: e.target.value })} 
              />
              <input 
                className="input" 
                placeholder="آدرس کیف پول (اختیاری)" 
                value={form.address} 
                onChange={e => setForm({ ...form, address: e.target.value })} 
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button className="btn-gold flex-1" onClick={save}>ذخیره</button>
              <button 
                className="flex-1 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50" 
                onClick={() => setModal(false)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
