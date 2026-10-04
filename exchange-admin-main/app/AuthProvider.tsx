// app/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./dashboard/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  status: "loading" | "pending" | "approved" | "rejected";
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, status: "loading" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"loading" | "pending" | "approved" | "rejected">("loading");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        setStatus("loading");
        return;
      }

      setUser(currentUser);

      // ۱. اگر خود مدیر وارد شود، مستقیم تأیید است
      if (currentUser.email === "nasirahmadrahmati19@gmail.com") {
        setStatus("approved");
        setLoading(false);
        return;
      }

      // ۲. بررسی وضعیت کاربر در دیتابیس Firestore
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // کاربر کاملاً جدید است: ثبت با وضعیت "در انتظار"
          await setDoc(userRef, {
            email: currentUser.email,
            name: currentUser.displayName || "کاربر جدید",
            status: "pending",
            createdAt: new Date().toISOString(),
          });

          // ارسال ایمیل به مدیر از طریق API که در مرحله ۲ ساختیم
          await fetch("/api/notify-admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userEmail: currentUser.email,
              userName: currentUser.displayName || "کاربر جدید",
            }),
          });

          setStatus("pending");
        } else {
          // کاربر قبلاً ثبت‌نام کرده، وضعیتش را بخوان
          setStatus(userSnap.data().status || "pending");
        }
      } catch (error) {
        console.error("خطا در بررسی وضعیت کاربر:", error);
        setStatus("pending"); // در صورت خطا، برای امنیت بیشتر در حالت انتظار می‌ماند
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, loading, status }), [user, loading, status]);

  // حالت بارگذاری اولیه
  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm font-bold">در حال اتصال امن...</p>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  // حالت در انتظار تأیید مدیر
  if (status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-900 p-6 text-center transition-colors duration-300">
        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-200 dark:border-amber-800 max-w-md w-full">
          <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-4">⏳ حساب شما در انتظار تأیید است</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            درخواست ورود شما با موفقیت ثبت شد و ایمیلی برای مدیر برنامه ارسال گردید.<br />
            پس از تأیید مدیر، می‌توانید وارد داشبورد شوید.
          </p>
          <button 
            onClick={() => signOut(auth)} 
            className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors"
          >
            خروج از حساب کاربری
          </button>
        </div>
      </div>
    );
  }

  // حالت رد شدن دسترسی
  if (status === "rejected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-900 p-6 text-center transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-200 dark:border-red-800 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">❌ دسترسی شما رد شده است</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            مدیر برنامه درخواست ورود شما را تأیید نکرده است.
          </p>
          <button 
            onClick={() => signOut(auth)} 
            className="w-full px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors"
          >
            خروج از حساب کاربری
          </button>
        </div>
      </div>
    );
  }

  // حالت تأیید شده (ورود موفق به برنامه اصلی)
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
