// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "مقدار_کپی_شده_از_فایربیس",
  authDomain: "مقدار_کپی_شده_از_فایربیس",
  projectId: "مقدار_کپی_شده_از_فایربیس",
  storageBucket: "مقدار_کپی_شده_از_فایربیس",
  messagingSenderId: "مقدار_کپی_شده_از_فایربیس",
  appId: "مقدار_کپی_شده_از_فایربیس"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
