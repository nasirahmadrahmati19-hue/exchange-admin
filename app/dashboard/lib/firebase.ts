import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, disableNetwork, enableNetwork } from "firebase/firestore";

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

// ✅ استفاده از getFirestore به جای initializeFirestore (جلوگیری از خطای تکرار)
// در Firebase v10، persistentLocalCache به صورت پیش‌فرض فعال است
export const db = getFirestore(app);

// ✅ مدیریت هوشمند شبکه برای جلوگیری از کرش در حالت آفلاین
if (typeof window !== 'undefined') {
  // شنود رویداد قطع اینترنت -> توقف فوری درخواست‌های شبکه (جلوگیری از Memory Leak)
  window.addEventListener('offline', () => {
    console.log('🔴 Network offline: Disabling Firestore network requests to save resources.');
    disableNetwork(db).catch(console.error);
  });

  // شنود رویداد وصل شدن اینترنت -> فعال‌سازی مجدد و همگام‌سازی خودکار
  window.addEventListener('online', () => {
    console.log('🟢 Network online: Enabling Firestore network requests and syncing.');
    enableNetwork(db).catch(console.error);
  });
}
