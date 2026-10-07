"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
// مسیر اصلاح شده: چون lib و AuthProvider هر دو داخل پوشه app هستند، از ./ استفاده می‌کنیم
import { auth, db } from "./lib/firebase"; 

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        // استفاده از UID به عنوان کلید اصلی، تضمین‌کننده بازگشت اطلاعات پس از نصب مجدد است
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.log("✅ کاربر جدید شناسایی شد. در حال ساخت حساب کاربری فعال...");
          
          // ساخت حساب کاربری به صورت خودکار و بدون نیاز به تایید ادمین
          await setDoc(userRef, {
            email: currentUser.email,
            name: currentUser.displayName || "کاربر جدید",
            photoURL: currentUser.photoURL || null,
            createdAt: new Date().toISOString(),
            isActive: true, // کاربر به صورت پیش‌فرض فعال است
          });
          
          console.log("✅ حساب کاربری با موفقیت ساخته و فعال شد.");
        } else {
          console.log("ℹ️ کاربر قبلاً ثبت‌نام کرده است. اطلاعات بارگذاری شد.");
        }
      } catch (error) {
        console.error("❌ خطا در بررسی یا ساخت حساب کاربری:", error);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  // نمایش صفحه لودینگ فقط در هنگام بررسی اولیه وضعیت احراز هویت
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

  // اگر کاربر لاگین باشد (loading تمام شده)، محتویات برنامه (داشبورد) نمایش داده می‌شود
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
