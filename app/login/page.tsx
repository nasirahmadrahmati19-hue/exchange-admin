"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../dashboard/lib/firebase";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // ✅ حالت عادی: هر کاربری که با ایمیل ثبت‌نام کند، بلافاصله وارد می‌شود.
  // هیچ تأیید مدیر (isApproved) لازم نیست.

  const ensureUserDoc = async (uid: string, displayName: string, userEmail: string) => {
    if (!db) return;
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          email: userEmail,
          name: displayName || userEmail,
          createdAt: new Date().toISOString(),
          isActive: true,
        });
      }
    } catch (e) {
      console.error("خطا در ساخت سند کاربر:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        // ۱. ساخت حساب با ایمیل و رمز
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // ۲. ذخیره نام کاربر
        if (name.trim()) {
          try { await updateProfile(cred.user, { displayName: name.trim() }); } catch {}
        }
        // ۳. ساخت سند Firestore (بدون فیلد تأیید — کاربر فعال است)
        await ensureUserDoc(cred.user.uid, name.trim(), cred.user.email || email.trim());
        // ۴. ورود مستقیم به داشبورد
        router.push("/dashboard");
        return;
      }

      // حالت ورود
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserDoc(cred.user.uid, cred.user.displayName || "", cred.user.email || email.trim());
      router.push("/dashboard");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("این ایمیل قبلاً ثبت‌نام کرده است. از بخش «ورود» استفاده کنید.");
      } else if (code === "auth/weak-password") {
        setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
      } else if (code === "auth/invalid-email") {
        setError("فرمت ایمیل صحیح نیست.");
      } else if (
        code === "auth/invalid-credential" ||
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"
      ) {
        setError("ایمیل یا رمز عبور اشتباه است.");
      } else if (code === "auth/too-many-requests") {
        setError("تلاش زیاد بود. لطفاً چند دقیقه بعد دوباره امتحان کنید.");
      } else if (code === "auth/network-request-failed") {
        setError("اتصال اینترنت را بررسی کنید.");
      } else {
        setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-900 transition-colors" dir="rtl">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white">
          {mode === "login" ? "ورود به پنل صرافی" : "ایجاد حساب کاربری"}
        </h2>

        {/* تغییر بین ورود و ثبت‌نام */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-slate-700 p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login"
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            ورود
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "register"
                ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            ثبت‌نام
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm rounded-md border bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">نام کامل</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                placeholder="مثلاً: نصیر احمد"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">ایمیل</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              placeholder="example@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">رمز عبور</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ${
              mode === "register"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading
              ? "در حال بررسی..."
              : mode === "register"
              ? "ثبت‌نام و ورود"
              : "ورود به حساب"}
          </button>
        </form>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
          صرافی برادران نورزاد — هرات
        </p>
      </div>
    </div>
  );
}
