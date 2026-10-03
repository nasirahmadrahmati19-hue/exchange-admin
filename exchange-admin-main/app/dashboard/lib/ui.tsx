// lib/ui.tsx
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { shareLinks, openPDF } from "./helpers"; // مطمئن شوید مسیر helpers صحیح است

// ✅ هوک بهینه‌شده برای ذخیره‌سازی در LocalStorage
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [isHydrated, setIsHydrated] = useState(false);

  // فقط یک بار هنگام Mount شدن، مقدار را از localStorage بخوان
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) {
        setValue(JSON.parse(s));
      }
    } catch (e) {
      console.warn("Error reading localStorage key:", key, e);
    }
    setIsHydrated(true);
  }, [key]);

  // هر بار که value تغییر کرد، آن را ذخیره کن
  useEffect(() => {
    if (!isHydrated) return; // تا زمانی که هیدریت نشده، ذخیره نکن
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Error writing to localStorage key:", key, e);
    }
  }, [value, key, isHydrated]);

  return [value, setValue, isHydrated] as const;
}

// ✅ کامپوننت Field با پشتیبانی از حالت خطا
export function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; missing?: string[]; name?: string;
}) {
  const isMissing = props.name && props.missing ? props.missing.includes(props.name) : false;
  return (
    <div className="mb-4">
      <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{props.label}</label>
      <input
        type={props.type || "text"}
        className={`w-full px-4 py-2 rounded-xl border bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 transition-all ${
          isMissing 
            ? "border-red-500 focus:ring-red-200" 
            : "border-slate-200 dark:border-slate-700 focus:ring-emerald-200 dark:focus:ring-emerald-900"
        }`}
        placeholder={props.placeholder}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
      />
    </div>
  );
}

// ✅ کامپوننت SelectField
export function SelectField(props: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-300">{props.label}</label>
      <select 
        className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-200"
        value={props.value} 
        onChange={e => props.onChange(e.target.value)}
      >
        {props.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ✅ کامپوننت نمایش خطا
export function ErrorBox({ error }: { error: string }) {
  if (!error) return null;
  return (
    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-xl p-3 border border-red-200 dark:border-red-800 mb-4">
      {error}
    </div>
  );
}

// ✅ کامپوننت Modal (پنجره بازشو)
export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-extrabold text-lg text-slate-900 dark:text-white">{props.title}</h2>
          <button onClick={props.onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

// ✅ نوار اشتراک‌گذاری
export function ShareBar(props: {
  text: string; phone?: string; pdfTitle?: string; pdfRows?: { label: string; value: string }[];
}) {
  const links = shareLinks(props.text, props.phone);
  const btn = "px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors shadow-sm hover:shadow-md active:scale-95";
  
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={`${btn} bg-emerald-600 hover:bg-emerald-700`}>واتساپ</a>
      <a href={links.telegram} target="_blank" rel="noopener noreferrer" className={`${btn} bg-sky-600 hover:bg-sky-700`}>تلگرام</a>
      <a href={links.email} className={`${btn} bg-slate-600 hover:bg-slate-700`}>ایمیل</a>
      <a href={links.sms} className={`${btn} bg-indigo-600 hover:bg-indigo-700`}>پیامک</a>
      <button 
        onClick={() => openPDF(props.pdfTitle || "جزئیات", props.pdfRows || [])} 
        className={`${btn} bg-rose-600 hover:bg-rose-700`}
      >
        PDF / چاپ
      </button>
    </div>
  );
}
