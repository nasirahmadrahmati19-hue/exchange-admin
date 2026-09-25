import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_Ih73FJf6gTh6pQJlMemDD-FrDICY0pE",
  authDomain: "myproject-707c8.firebaseapp.com",
  projectId: "myproject-707c8",
  storageBucket: "myproject-707c8.firebasestorage.app",
  messagingSenderId: "922894348479",
  appId: "1:922894348479:web:82988406466df932e7160a"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// ✅ راه‌حل قطعی برای خطای 400 و قطع شدن اتصال Firestore
// این تنظیم فایربیس را مجبور می‌کند از Long-Polling استفاده کند که در برابر مسدودسازی و فشار شبکه مقاوم‌تر است.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, 
});
