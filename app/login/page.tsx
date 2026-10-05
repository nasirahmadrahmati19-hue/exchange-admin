"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../dashboard/lib/firebase"; // مسیر فایل firebase شما

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false); // برای تشخیص حالت "در انتظار تایید"
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(false);
    setLoading(true);

    try {
      // ۱. احراز هویت اولیه توسط فایربیس
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ۲. بررسی وضعیت تایید در دیتابیس Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.isApproved === true) {
          // ✅ کاربر تایید شده است، ورود موفق
          router.push("/dashboard");
        } else {
          // ⏳ کاربر تایید نشده است
          await signOut(auth); // خروج فوری کاربر از سیستم
          setIsPending(true);
          setError("حساب کاربری شما هنوز توسط مدیر تأیید نشده است. لطفاً شکیبا باشید.");

          // ۳. ارسال نوتیفیکیشن به مدیر (جهت یادآوری که این شخص دوباره تلاش کرده)
          try {
            await fetch("/api/notify-admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userEmail: user.email,
                userName: userData.name || user.email,
                uid: user.uid,
              }),
            });
          } catch (notifyErr) {
            console.error("خطا در ارسال نوتیفیکیشن به مدیر:", notifyErr);
          }
        }
      } else {
        // حالت نادر: کاربر در Auth هست اما در Firestore دیتایی ندارد
        await signOut(auth);
        setError("خطا در دریافت اطلاعات کاربر. لطفاً با پشتیبانی تماس بگیرید.");
      }
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || 
          err.code === "auth/user-not-found" || 
          err.code === "auth/wrong-password") {
        setError("ایمیل یا رمز عبور اشتباه است.");
      } else if (err.code === "auth/invalid-email") {
        setError("فرمت ایمیل صحیح نیست.");
      } else {
        setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100" dir="rtl">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">ورود به پنل صرافی</h2>
        
        {/* نمایش پیام خطا با رنگ‌بندی هوشمند */}
        {error && (
          <div className={`p-3 text-sm rounded-md border ${
            isPending 
              ? "bg-amber-50 text-amber-800 border-amber-200" // رنگ زرد برای حالت در انتظار
              : "bg-red-50 text-red-700 border-red-200"       // رنگ قرمز برای خطای واقعی (رمز اشتباه و...)
          }`}>
            {isPending && <span className="font-bold block mb-1">⏳ در انتظار تأیید:</span>}
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="example@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">رمز عبور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? "در حال بررسی..." : "ورود به حساب"}
          </button>
        </form>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          صرافی برادران نورزاد — هرات
        </p>
      </div>
    </div>
  );
}
