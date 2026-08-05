"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) setValue(JSON.parse(s));
    } catch {}
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

export function SelectField(props: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
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
      <div className="card w-full max-w-md p-6">
        <h2 className="font-extrabold mb-5">{props.title}</h2>
        {props.children}
      </div>
    </div>
  );
}
