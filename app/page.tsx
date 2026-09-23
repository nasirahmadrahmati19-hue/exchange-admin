"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // هدایت خودکار کاربر به داشبورد برای استفاده از سیستم ورود جدید
    router.push("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0b1f2e] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#d9a441]/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-700/20 blur-3xl" />
      
      <div className="text-center relative z-10 fade-up">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center shadow-lg shadow-amber-900/30 mb-6 animate-pulse">
          <svg viewBox="0 0 24 24" fill="none" stroke="#0b1f2e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
            <path d="M12 2 2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2">صرافی برادران نورزاد</h1>
        <p className="text-slate-400">در حال انتقال به پنل مدیریت...</p>
      </div>
    </div>
  );
}
