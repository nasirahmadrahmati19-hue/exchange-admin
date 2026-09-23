"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./dashboard/lib/firebase"; 

// 🚨 ایمیل مالک اصلی
const OWNER_EMAIL = "nasirahmadrahmati19@gmail.com";

export default function AuthGate() {
  const router = useRouter();
  const pathname = usePathname(); // ✅ مسیر فعلی را می‌گیریم
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // ✅ لایه محافظتی ۱: جلوگیری از اجرای چندباره
  const hasRedirected = useRef(false);
  const isChecking = useRef(false);

  useEffect(() => {
    // ✅ لایه محافظتی ۲: اگر الان در dashboard هستیم، هیچ کاری نکن
    if (pathname === '/dashboard') {
      setCheckingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // ✅ لایه محافظتی ۳: جلوگیری از اجرای همزمان
      if (isChecking.current) return;
      
      setUser(currentUser);
      
      if (currentUser) {
        // ✅ فقط اگر هنوز redirect نکردیم و در صفحه اصلی هستیم
        if (!hasRedirected.current && pathname === '/') {
          isChecking.current = true;
          await checkAuthorization(currentUser.email);
          isChecking.current = false;
        }
      } else {
        setIsAuthorized(false);
        setCheckingAuth(false);
        hasRedirected.current = false;
      }
    });
    
    return () => unsubscribe();
  }, [pathname]); // ✅ فقط وقتی pathname تغییر کرد اجرا شود

  const checkAuthorization = async (email: string | null) => {
    if (!email || hasRedirected.current) return;
    
    // ✅ چک نهایی قبل از redirect
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      return;
    }
    
    setErrorMsg("");
    
    // ۱. اگر مالک اصلی است
    if (email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      setIsAuthorized(true);
      setCheckingAuth(false);
      hasRedirected.current = true;
      
      // ✅ استفاده از window.location به جای router برای اطمینان بیشتر
      window.location.href = '/dashboard';
      return;
    }

    // ۲. بررسی لیست کاربران مجاز
    try {
      const userDoc = await getDoc(doc(db, "authorized_users", email));
      if (userDoc.exists()) {
        setIsAuthorized(true);
        hasRedirected.current = true;
        window.location.href = '/dashboard'; // ✅ redirect کامل مرورگر
      } else {
        setIsAuthorized(false);
        setCheckingAuth(false);
      }
    } catch (error) {
      console.error("خطا در بررسی دسترسی:", error);
      setIsAuthorized(false);
      setCheckingAuth(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("خطا در ورود:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMsg("پنجره ورود بسته شد.");
      } else if (error.code === 'auth/popup-blocked') {
        setErrorMsg("مرورگر پنجره ورود را مسدود کرد.");
      } else {
        setErrorMsg("خطا در ورود: " + error.message);
      }
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (e) {
      console.error("خطا در خروج:", e);
    }
    setUser(null);
    setIsAuthorized(false);
    setCheckingAuth(false);
    setErrorMsg("");
    setLoading(false);
    hasRedirected.current = false;
  };

  // --- حالت‌های نمایش ---

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0b1f2e] flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">در حال بررسی سیستم...</div>
      </div>
    );
  }

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
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-bold py-3 px-4 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {loading ? "در حال ورود..." : "ورود با حساب گوگل"}
          </button>
        </div>
      </div>
    );
  }

  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0b1f2e] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-rose-500/10 border border-rose-500/30 rounded-3xl p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-rose-500 rounded-full flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="w-8 h-8"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-rose-400 mb-2">دسترسی غیرمجاز</h2>
          <p className="text-slate-300 text-sm mb-6">
            ایمیل <span className="text-white font-mono bg-rose-500/20 px-1 rounded">{user.email}</span> توسط سازنده برنامه تأیید نشده است.
          </p>
          <button onClick={handleLogout} disabled={loading} className="bg-rose-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-rose-700 transition-all disabled:opacity-50">
            {loading ? "در حال خروج..." : "خروج و انتخاب حساب دیگر"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1f2e] flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">در حال انتقال به پنل مدیریت...</div>
    </div>
  );
}
