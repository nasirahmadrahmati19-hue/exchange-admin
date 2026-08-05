"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { shareLinks, openPDF } from "./helpers";

export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setValue(JSON.parse(s)); } catch {}
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(key, JSON.stringify(value));
  }, [value, loaded, key]);
  return [value, setValue] as const;
}

export function Field(props: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; missing?: string[]; name?: string;
}) {
  const isMissing = props.name && props.missing ? props.missing.includes(props.name) : false;
  return (
    <div>
      <label className="block text-sm font-bold mb-2">{props.label}</label>
      <input
        type={props.type || "text"}
        className={`input ${isMissing ? "!border-red-500" : ""}`}
        placeholder={props.placeholder}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
      />
    </div>
  );
}

export function SelectField(props: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-sm font-bold mb-2">{props.label}</label>
      <select className="input" value={props.value} onChange={e => props.onChange(e.target.value)}>
        {props.options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function ErrorBox({ error }: { error: string }) {
  if (!error) return null;
  return <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">{error}</div>;
}

export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="font-extrabold mb-5">{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}

export function ShareBar(props: {
  text: string; phone?: string; pdfTitle?: string; pdfRows?: { label: string; value: string }[];
}) {
  const links = shareLinks(props.text, props.phone);
  const btn = "px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors";
  return (
    <div className="flex flex-wrap gap-2">
      <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={`${btn} bg-emerald-600 hover:bg-emerald-700`}>واتساپ</a>
      <a href={links.telegram} target="_blank" rel="noopener noreferrer" className={`${btn} bg-sky-600 hover:bg-sky-700`}>تلگرام</a>
      <a href={links.email} className={`${btn} bg-slate-600 hover:bg-slate-700`}>ایمیل</a>
      <a href={links.sms} className={`${btn} bg-indigo-600 hover:bg-indigo-700`}>پیامک</a>
      <button onClick={() => openPDF(props.pdfTitle || "جزئیات", props.pdfRows || [])} className={`${btn} bg-rose-600 hover:bg-rose-700`}>PDF / چاپ</button>
    </div>
  );
}
