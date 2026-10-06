"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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
        console.log("✅ مدیر سیستم وارد شد. دسترسی مستقیم تأیید گردید.");
        setStatus("approved");
        setLoading(false);
        return;
      }

      // ۲. بررسی وضعیت کاربر در دیتابیس Firestore
      try {
        console.log("🔍 شروع بررسی وضعیت کاربر در فایربیس...");
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.log("✅ کاربر جدید شناسایی شد. در حال ثبت در دیتابیس...");
          
          // ثبت کاربر با هر دو فیلد برای سازگاری کامل
          await setDoc(userRef, {
            email: currentUser.email,
            name: currentUser.displayName || "کاربر جدید",
            isApproved: false, // فیلد اصلی برای تایید
            status: "pending", // فیلد کمکی برای نمایش وضعیت
            createdAt: new Date().toISOString(),
          });
          
          console.log("✅ ثبت در دیتابیس با موفقیت انجام شد. در حال فراخوانی API ارسال ایمیل...");

          // ✅ اصلاح مهم: ارسال uid به API برای ساخت لینک تایید
          const response = await fetch("/api/notify-admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userEmail: currentUser.email,
              userName: currentUser.displayName || "کاربر جدید",
              uid: currentUser.uid, // این خط حیاتی است
            }),
          });

          if (response.ok) {
            console.log("📧 درخواست ارسال ایمیل با موفقیت به سرور فرستاده شد.");
            // ثبت زمان ارسال برای جلوگیری از اسپم یادآوری‌ها
            await updateDoc(userRef, { lastNotifiedAt: new Date().toISOString() });
          } else {
            const errorText = await response.text();
            console.error("❌ سرور پاسخ خطا داد:", errorText);
          }

          setStatus("pending");
        } else {
          const userData = userSnap.data();
          console.log("ℹ️ کاربر قبلاً ثبت‌نام کرده است. وضعیت:", userData);
          
          // ✅ اصلاح مهم: بررسی فیلد isApproved که توسط approve-user تغییر می‌کند
          if (userData.isApproved === true || userData.status === "approved") {
            setStatus("approved");
          } else if (userData.status === "rejected") {
            setStatus("rejected");
          } else {
            // 🔁 کاربر هنوز در انتظار تأیید است — اگر مدیر قبلاً درخواست را ندیده
            // یا ایمیل گم شده، دوباره ایمیل یادآوری ارسال می‌شود (حداکثر یک بار در ساعت).
            try {
              const lastNotifiedAt = userData.lastNotifiedAt
                ? new Date(userData.lastNotifiedAt).getTime()
                : 0;
              const ONE_HOUR = 60 * 60 * 1000;

              if (Date.now() - lastNotifiedAt > ONE_HOUR) {
                console.log("📧 ارسال مجدد درخواست تأیید به مدیر (یادآوری)...");
                const notifyRes = await fetch("/api/notify-admin", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    userEmail: currentUser.email,
                    userName: userData.name || currentUser.displayName || "کاربر جدید",
                    uid: currentUser.uid,
                  }),
                });
                if (notifyRes.ok) {
                  await updateDoc(userRef, { lastNotifiedAt: new Date().toISOString() });
                  console.log("✅ ایمیل یادآوری برای مدیر ارسال شد.");
                } else {
                  console.error("❌ ارسال یادآوری ناموفق بود:", await notifyRes.text());
                }
              } else {
                console.log("⏳ آخرین ایمیل کمتر از یک ساعت قبل ارسال شده؛ از ارسال مجدد خودداری شد.");
              }
            } catch (notifyError) {
              console.error("❌ خطا در ارسال یادآوری:", notifyError);
            }
            setStatus("pending");
          }
        }
      } catch (error) {
        console.error("❌❌❌ خطا در فایربیس یا ارسال ایمیل:", error);
        setStatus("pending"); // در صورت خطای شبکه، محتاطانه در حالت pending می‌مانیم
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(() => ({ user, loading, status }), [user, loading, status]);

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

  if (status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-900 p-6 text-center transition-colors duration-300">
        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-200 dark:border-amber-800 max-w-md w-full shadow-lg">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-4">حساب شما در انتظار تأیید است</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed text-sm">
            درخواست ورود شما با موفقیت ثبت شد و ایمیلی برای مدیر برنامه ارسال گردید.<br />
            پس از تأیید مدیر از طریق لینک داخل ایمیل، می‌توانید وارد داشبورد شوید.
          </p>
          <button 
            onClick={() => signOut(auth)} 
            className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-md"
          >
            خروج از حساب کاربری
          </button>
        </div>
      </div>
    );
  }

  if (status === "rejected") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-900 p-6 text-center transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-200 dark:border-red-800 max-w-md w-full shadow-lg">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">دسترسی شما رد شده است</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            مدیر برنامه درخواست ورود شما را تأیید نکرده است.
          </p>
          <button 
            onClick={() => signOut(auth)} 
            className="w-full px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-bold transition-colors shadow-md"
          >
            خروج از حساب کاربری
          </button>
        </div>
      </div>
    );
  }

  // اگر وضعیت approved باشد، کودکان (children) یعنی داشبورد رندر می‌شود
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
