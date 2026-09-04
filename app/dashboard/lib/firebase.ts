import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// راه‌اندازی برنامه فایربیس
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// سرویس احراز هویت (برای ورود با جیمیل)
export const auth = getAuth(app);

// 🔑 سرویس دیتابیس (برای ذخیره و خواندن اطلاعات)
export const db = getFirestore(app);

// 🔑 فعال‌سازی حالت آفلاین
// این کد باعث می‌شود وقتی گوشی/کامپیوتر اینترنت ندارد، اطلاعات گم نشود
// و به محض وصل شدن به اینترنت، خودکار به سرور ارسال شود.
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      // چندین تب مرورگر همزمان باز است
      console.warn("Persistence failed: Multiple tabs open");
    } else if (err.code === "unimplemented") {
      // مرورگر از این قابلیت پشتیبانی نمی‌کند
      console.warn("Persistence not supported by this browser");
    }
  });
}
