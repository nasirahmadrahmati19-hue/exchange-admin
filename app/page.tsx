"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { useAuth } from "./AuthProvider";
import { auth } from "./dashboard/lib/firebase";

export default function LoginPage() {
  // حذف status چون دیگر نیازی به بررسی تایید ادمین نیست
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [localLoading, setLocalLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // اگر کاربر وارد شده باشد، مستقیم به داشبورد هدایت می‌شود
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleLogin = async () => {
    setLocalLoading(true);
    setErrorMsg("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
      // بعد از لاگین موفق، AuthProvider به صورت خودکار حساب کاربر را در دیتابیس می‌سازد
      // و سپس useEffect بالا کاربر را به داشبورد هدایت می‌کند.
    } catch (error: any) {
      console.error("خطا در ورود:", error);
      if (error.code === "auth/popup-closed-by-user") {
        setErrorMsg("پنجره ورود بسته شد.");
      } else if (error.code === "auth/popup-blocked") {
        setErrorMsg("مرورگر پنجره ورود را مسدود کرد. لطفاً Pop-up blocker را غیرفعال کنید.");
      } else {
        setErrorMsg("خطا در ورود: " + error.message);
      }
      setLocalLoading(false);
    }
  };

  const handleLogout = async () => {
    setLocalLoading(true);
    try {
      await signOut(auth);
      setErrorMsg("");
    } catch (e) {
      console.error("خطا در خروج:", e);
    }
    setLocalLoading(false);
  };

  // حالت بارگذاری اولیه
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm font-bold">در حال بررسی سیستم...</p>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // اگر کاربر وارد نشده است، فرم لاگین زیبا را نشان بده
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0b1f2e] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#d9a441]/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-blue-700/20 blur-3xl" />

        <div className="w-full max-w-md relative bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center shadow-lg mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0b1f2e" strokeWidth={2} className="w-10 h-10">
              <path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">صرافی برادران نورزاد</h1>
          <p className="text-slate-300 text-sm mb-8">برای استفاده از برنامه، لطفاً وارد حساب گوگل خود شوید.</p>

          {errorMsg && (
            <div className="bg-rose-500/20 border border-rose-500/50 text-rose-200 text-sm rounded-xl p-3 mb-4">
              {errorMsg}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={localLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {localLoading ? "در حال ورود..." : "ورود با حساب گوگل"}
          </button>
        </div>
      </div>
    );
  }

  // در غیر این صورت (کاربر وارد شده و در حال انتقال به داشبورد است)
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm font-bold">حساب شما فعال شد. در حال انتقال به پنل مدیریت...</p>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
      </div>
    </div>
  );
}
