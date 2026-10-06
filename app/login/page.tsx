"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../dashboard/lib/firebase"; // مسیر فایل firebase شما

const ADMIN_EMAIL = "nasirahmadrahmati19@gmail.com";

// 🔑 تابع مرکزی ارسال درخواست تایید به مدیر — از همین صفحه و قبل از نمایش پیام.
// قبلاً ارسال ایمیل داخل AuthProvider بود که روی موبایل نصفه می‌ماند و
// ایمیل هرگز به مدیر نمی‌رسید (همان باگی که گزارش دادید).
async function sendApprovalRequest(uid: string, userEmail: string, userName: string) {
  try {
    const res = await fetch("/api/notify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, userEmail, userName }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("❌ notify-admin خطا داد:", res.status, t);
    } else {
      console.log("📧 درخواست تایید برای مدیر ارسال شد.");
    }
  } catch (e) {
    console.error("❌ خطا در فراخوانی notify-admin:", e);
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false); // برای تشخیص حالت "در انتظار تایید"
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(false);
    setLoading(true);

    try {
      if (mode === "register") {
        // ═══════ ۱. ساخت حساب جدید (ثبت‌نام) ═══════
        let user;
        try {
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          user = cred.user;
        } catch (regErr: any) {
          if (regErr.code === "auth/email-already-in-use") {
            setError("این ایمیل قبلاً ثبت شده است. حالا وارد شوید.");
            setMode("login");
            setLoading(false);
            return;
          }
          if (regErr.code === "auth/weak-password") {
            setError("رمز عبور باید حداقل ۶ کاراکتر باشد.");
            setLoading(false);
            return;
          }
          throw regErr;
        }

        if (name.trim()) {
          await updateProfile(user, { displayName: name.trim() }).catch(() => {});
        }

        // ثبت کاربر در Firestore با وضعیت pending
        try {
          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            name: name.trim() || user.email,
            isApproved: false,
            status: "pending",
            createdAt: new Date().toISOString(),
            lastNotifiedAt: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.error("❌ خطا در نوشتن کاربر در Firestore:", dbErr);
        }

        // 📧 ارسال قطعی درخواست تایید به مدیر — صبر می‌کنیم تا سرور پاسخ دهد
        await sendApprovalRequest(user.uid, user.email || "", name.trim() || user.email || "کاربر جدید");

        await signOut(auth); // تا تایید نشود نباید وارد شود
        setIsPending(true);
        setError("حساب شما ساخته شد و درخواست ورود برای مدیر ارسال گردید. پس از تایید، با همین ایمیل و رمز وارد شوید.");
        setLoading(false);
        return;
      }

      // ═══════ ۲. ورود (Login) ═══════
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // اگر خود مدیر وارد شود، مستقیم به داشبورد
      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        router.push("/dashboard");
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        // کاربر در Auth هست اما سند Firestore ندارد → بساز و درخواست بفرست
        try {
          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            name: user.displayName || user.email,
            isApproved: false,
            status: "pending",
            createdAt: new Date().toISOString(),
            lastNotifiedAt: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.error("❌ خطا در ساخت سند کاربر:", dbErr);
        }
        await sendApprovalRequest(user.uid, user.email || "", user.displayName || user.email || "کاربر جدید");
        await signOut(auth);
        setIsPending(true);
        setError("اطلاعات حساب شما مجدداً ثبت شد و درخواست ورود برای مدیر ارسال گردید.");
        setLoading(false);
        return;
      }

      const userData = userSnap.data();

      if (userData.isApproved === true || userData.status === "approved") {
        // ✅ کاربر تایید شده است، ورود موفق
        router.push("/dashboard");
      } else {
        // ⏳ کاربر تایید نشده است
        await signOut(auth); // خروج فوری کاربر از سیستم
        setIsPending(true);
        setError("حساب کاربری شما هنوز توسط مدیر تأیید نشده است. لطفاً شکیبا باشید.");

        // یادآوری به مدیر — حداکثر یک بار در هر ۲ دقیقه
        try {
          const last = userData.lastNotifiedAt ? new Date(userData.lastNotifiedAt).getTime() : 0;
          if (Date.now() - last > 2 * 60 * 1000) {
            await updateDoc(doc(db, "users", user.uid), { lastNotifiedAt: new Date().toISOString() }).catch(() => {});
            await sendApprovalRequest(user.uid, user.email || "", userData.name || user.email || "کاربر جدید");
          }
        } catch (notifyErr) {
          console.error("خطا در ارسال نوتیفیکیشن به مدیر:", notifyErr);
        }
        setLoading(false);
      }
    } catch (err: any) {
      if (err.code === "auth/invalid-credential" ||
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password") {
        setError("ایمیل یا رمز عبور اشتباه است. اگر حساب ندارید، اول «ساخت حساب جدید» را بزنید.");
      } else if (err.code === "auth/invalid-email") {
        setError("فرمت ایمیل صحیح نیست.");
      } else {
        setError("خطایی رخ داد. لطفاً دوباره تلاش کنید.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100" dir="rtl">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">
          {mode === "login" ? "ورود به پنل صرافی" : "ساخت حساب جدید"}
        </h2>
        
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

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">نام / نام صرافی</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="مثلاً: احمد"
              />
            </div>
          )}

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
            {loading ? "در حال بررسی..." : mode === "login" ? "ورود به حساب" : "ساخت حساب و ارسال درخواست ورود"}
          </button>
        </form>

        <p className="text-xs text-center text-gray-600 mt-2">
          {mode === "login" ? (
            <>حساب ندارید؟{' '}
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); }}
                className="text-blue-600 font-bold underline"
              >
                ساخت حساب جدید
              </button>
            </>
          ) : (
            <>حساب دارید؟{' '}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className="text-blue-600 font-bold underline"
              >
                وارد شوید
              </button>
            </>
          )}
        </p>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          صرافی برادران نورزاد — هرات
        </p>
      </div>
    </div>
  );
}
