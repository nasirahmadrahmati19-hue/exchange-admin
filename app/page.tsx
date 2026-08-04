"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    let u = "admin", p = "admin123";
    try {
      const s = JSON.parse(localStorage.getItem("db_settings") || "null");
      if (s?.username) u = s.username;
      if (s?.password) p = s.password;
    } catch {}
    if (username === u && password === p) {
      localStorage.setItem("isAuthenticated", "true");
      router.push("/dashboard");
    } else {
      setError("نام کاربری یا رمز عبور اشتباه است");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1f2e] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#d9a441]/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-700/20 blur-3xl" />
      <div className="w-full max-w-md relative fade-up">
        <div className="card p-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center shadow-lg shadow-amber-900/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0b1f2e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-center mt-4">صرافی برادران نورزاد</h1>
          <p className="text-center text-sm text-slate-500 mt-2 mb-8">پنل مدیریت — ورود امن</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="text" className="input" placeholder="نام کاربری" value={username} onChange={e => setUsername(e.target.value)} />
            <input type="password" className="input" placeholder="رمز عبور" value={password} onChange={e => setPassword(e.target.value)} />
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3 border border-red-100">{error}</div>}
            <button type="submit" className="btn-gold w-full">ورود به پنل</button>
          </form>
        </div>
      </div>
    </div>
  );
}
