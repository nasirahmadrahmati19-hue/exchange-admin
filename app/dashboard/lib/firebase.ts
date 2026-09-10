// ۱. ایمپورت کردن توابع لازم از فایربیس
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ۲. تنظیمات فایربیس (مقادیر مستقیم برای تست)
const firebaseConfig = {
  apiKey: "AIzaSyB_Ih73FJf6gTh6pQJlMemDD-FrDICY0pE",
  authDomain: "myproject-707c8.firebaseapp.com",
  projectId: "myproject-707c8",
  storageBucket: "myproject-707c8.firebasestorage.app",
  messagingSenderId: "922894348479",
  appId: "1:922894348479:web:82988406466df932e7160a"
};

// ۳. جلوگیری از ساخت چندین نمونه از برنامه فایربیس
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ۴. ✅ بخش حیاتی: ساخت و صادر کردن (export) سرویس‌ها
export const auth = getAuth(app);
export const db = getFirestore(app);
