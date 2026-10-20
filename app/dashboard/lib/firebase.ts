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

const firebaseConfig = {
  apiKey: "AIzaSyB_Ih73FJf6gTh6pQJlMemDD-FrDICY0pE",
  authDomain: "myproject-707c8.firebaseapp.com",
  projectId: "myproject-707c8",
  storageBucket: "myproject-707c8.firebasestorage.app",
  messagingSenderId: "922894348479",
  appId: "1:922894348479:web:82988406466df932e7160a"
};

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
