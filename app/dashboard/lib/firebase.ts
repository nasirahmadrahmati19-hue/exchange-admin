// dashboard/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";

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

// ✅ تنظیمات بهینه Firestore برای جلوگیری از خطای 400 و پرش اتصال
// experimentalForceLongPolling: اتصال پایدارتر در شبکه‌های ناپایدار
// persistentLocalCache: کش کردن داده‌ها برای لود سریع‌تر و جلوگیری از رفرش‌های تکراری
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache(),
});
