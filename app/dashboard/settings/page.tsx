"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [s, setS] = useState({ siteName: "صرافی برادران نورزاد", whatsappPhone: "989121234567", commission: "0.5", username: "admin", password: "admin123" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("db_settings");
    if (v) { try { setS({ ...s, ...JSON.parse(v) }); } catch {} }
  }, []);

  const save = () => {
    localStorage.setItem("db_settings", JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">تنظیمات</h1>
      <div className="card p-6 max-w-2xl space-y-4">
        <div><label className="block text-sm font-bold mb-2">نام صرافی</label><input className="input" value={s.siteName} onChange={e => setS({ ...s, siteName: e.target.value })} /></div>
        <div><label className="block text-sm font-bold mb-2">شماره واتساپ (با کد کشور)</label><input className="input" value={s.whatsappPhone} onChange={e => setS({ ...s, whatsappPhone: e.target.value })} /></div>
        <div><label className="block text-sm font-bold mb-2">کارمزد معاملات (٪)</label><input className="input" value={s.commission} onChange={e => setS({ ...s, commission: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-bold mb-2">نام کاربری ورود</label><input className="input" value={s.username} onChange={e => setS({ ...s, username: e.target.value })} /></div>
          <div><label className="block text-sm font-bold mb-2">رمز عبور ورود</label><input className="input" value={s.password} onChange={e => setS({ ...s, password: e.target.value })} /></div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-gold" onClick={save}>ذخیره تنظیمات</button>
          {saved && <span className="text-emerald-600 text-sm font-bold">✔ ذخیره شد</span>}
        </div>
      </div>
    </div>
  );
}
