import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
  type FirestoreSettings,
} from "firebase/firestore";

// 🔧 پیکربندی Firebase:
// - اگر متغیرهای محیطی NEXT_PUBLIC_FIREBASE_* در Vercel تنظیم شده باشند، از آن‌ها استفاده می‌شود.
// - در غیر این صورت، مقادیر هاردکدشده fallback هستند (کلیدهای Web Config پروژه myproject-707c8).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyB_Ih73FJf6gTh6pQJlMemDD-FrDICY0pE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "myproject-707c8.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "myproject-707c8",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "myproject-707c8.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "922894348479",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:922894348479:web:82988406466df932e7160a"
};

// ⚠️ عیب‌یابی موقت build-time: فقط «تعریف شده بودن» کلیدها چاپ می‌شود، نه مقدار آن‌ها.
console.log("[firebase config check]", {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "defined" : "undefined (using hardcoded fallback)",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "defined" : "undefined (using hardcoded fallback)",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "defined" : "undefined (using hardcoded fallback)",
});

// ✅ جلوگیری از Initialize شدن تکراری اپلیکیشن در Hot Reload یا SSR
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// ============================================================
// 🔥 مرحله ۲: Firebase Offline Persistence (حالت آفلاین)
// ------------------------------------------------------------
// - localCache: persistentLocalCache → کش دائمی داده‌ها در IndexedDB مرورگر.
//   این فقط «کش موقت» است؛ Firestore همچنان تنها منبع حقیقت (SSOT) است و
//   هیچ داده مالی/هویتی/تنظیماتی در localStorage ذخیره نمی‌شود.
// - tabManager: persistentMultipleTabManager → هماهنگ‌سازی چند تب همزمان
//   روی یک کش مشترک IndexedDB (بدون قفل شدن یا تداخل).
// - توجه: getFirestore() در Firebase v10 persistence را غیرفعال می‌گذارد؛
//   برای فعال‌سازی حالت آفلاین باید initializeFirestore استفاده شود.
// - initializeFirestore فقط سمت کلاینت مجاز است؛ در SSR fallback امن داریم.
// ============================================================
const OFFLINE_SETTINGS: FirestoreSettings = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
};

function createDb(): Firestore | null {
  // سمت سرور (SSR): IndexedDB وجود ندارد — نمونه null برگردانده می‌شود.
  // تمام مصرف‌کنندگان db فقط در کامپوننت‌های "use client" اجرا می‌شوند.
  if (typeof window === "undefined") return null;

  try {
    return initializeFirestore(app, OFFLINE_SETTINGS);
  } catch (err: any) {
    // اگر قبلاً Firestore با تنظیمات دیگر مقداردهی اولیه شده باشد
    // (مثلاً Hot Reload)، به‌جای کرش، از همان نمونه موجود استفاده کن.
    console.warn(
      "⚠️ initializeFirestore تکراری بود؛ از نمونه موجود استفاده می‌شود:",
      err?.message
    );
    return getFirestore(app);
  }
}

// الگوی Singleton ایمن برای Next.js Fast Refresh / Strict Mode:
// ماژول ممکن است چند بار evaluate شود، اما فقط یک نمونه Firestore
// با persistence فعال ساخته می‌شود.
const globalForDb = globalThis as unknown as { __firestoreDb?: Firestore | null };

if (!globalForDb.__firestoreDb && typeof window !== "undefined") {
  globalForDb.__firestoreDb = createDb();
}

export const db: Firestore | null =
  globalForDb.__firestoreDb ?? (typeof window !== "undefined" ? createDb() : null);
