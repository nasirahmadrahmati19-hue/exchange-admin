"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [s, setS] = useState({
    siteName: "صرافی برادران نورزاد",
    whatsappPhone: "989121234567",
    commission: "0.5",
    username: "admin",
    password: "admin123"
  });
  const [saved, setSaved] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const v = localStorage.getItem("db_settings");
    if (v) {
      try { setS({ ...s, ...JSON.parse(v) }); } catch {}
    }
  }, []);

  const update = (patch: any) => {
    setS({ ...s, ...patch });
    setMissing([]);
    setError("");
  };

  const fc = (name: string) => `input ${missing.includes(name) ? "!border-red-500" : ""}`;

  const save = () => {
    const m: string[] = [];
    if (!s.siteName.trim()) m.push("نام صرافی");
    if (!s.whatsappPhone.trim()) m.push("شماره واتساپ");
    if (!s.username.trim()) m.push("نام کاربری ورود");
    if (!s.password.trim()) m.push("رمز عبور ورود");
    if (!s.commission.trim() || isNaN(Number(s.commission))) m.push("کارمزد");
    if (m.length > 0) {
      setMissing(m);
      setError("لطفاً این فیلدها را درست پر کنید: " + m.join("، "));
      return;
    }
    setMissing([]);
    setError("");
    localStorage.setItem("db_settings", JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">تنظیمات</h1>
      <div className="card p-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2">نام صرافی</label>
          <input className={fc("نام صرافی")} value={s.siteName} onChange={e => update({ siteName: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">شماره واتساپ (با کد کشور)</label>
          <input className={fc("شماره واتساپ")} value={s.whatsappPhone} onChange={e => update({ whatsappPhone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">کارمزد معاملات (%)</label>
          <input className={fc("کارمزد")} value={s.commission} onChange={e => update({ commission: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">نام کاربری ورود</label>
            <input className={fc("نام کاربری ورود")} value={s.username} onChange={e => update({ username: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">رمز عبور ورود</label>
            <input className={fc("رمز عبور ورود")} value={s.password} onChange={e => update({ password: e.target.value })} />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-200">{error}</div>
        )}
        <div className="flex items-center gap-3">
          <button className="btn-gold" onClick={save}>ذخیره تنظیمات</button>
          {saved && <span className="text-emerald-600 text-sm font-bold">ذخیره شد</span>}
        </div>
      </div>
    </div>
  );
}
