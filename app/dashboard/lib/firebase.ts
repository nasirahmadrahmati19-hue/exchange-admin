import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_Ih73FJf6gTh6pQJlMemDD-FrDICY0pE",
  authDomain: "myproject-707c8.firebaseapp.com",
  projectId: "myproject-707c8",
  storageBucket: "myproject-707c8.firebasestorage.app",
  messagingSenderId: "922894348479",
  appId: "1:922894348479:web:82988406466df932e7160a"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ⚠️ این دو خط حیاتی هستند. بدون این‌ها، برنامه باز نمی‌شود:
export const auth = getAuth(app);
export const db = getFirestore(app);
