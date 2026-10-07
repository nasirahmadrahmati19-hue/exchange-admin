// app/dashboard/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache,
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork
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

// ✅ تنظیم Auth برای ماندگاری در حالت آفلاین (جلوگیری از لاگ‌اوت ناگهانی)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}

// ✅ تنظیمات بهینه Firestore
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

// ✅ مدیریت هوشمند شبکه برای جلوگیری از کرش در حالت آفلاین
if (typeof window !== 'undefined') {
  // 1. فعال‌سازی پایگاه داده محلی (IndexedDB) با مدیریت خطا
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed: Multiple tabs open. Only one tab can use persistence.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence is not supported by this browser.');
    }
  });

  // 2. شنود رویداد قطع اینترنت -> توقف فوری درخواست‌های شبکه (جلوگیری از Memory Leak)
  window.addEventListener('offline', () => {
    console.log('🔴 Network offline: Disabling Firestore network requests to save resources.');
    disableNetwork(db).catch(console.error);
  });

  // 3. شنود رویداد وصل شدن اینترنت -> فعال‌سازی مجدد و همگام‌سازی خودکار
  window.addEventListener('online', () => {
    console.log('🟢 Network online: Enabling Firestore network requests and syncing.');
    enableNetwork(db).catch(console.error);
  });
}
