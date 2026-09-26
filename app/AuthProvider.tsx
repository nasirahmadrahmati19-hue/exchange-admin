// app/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";

// ✅ مسیر را بر اساس ساختار پروژه خود اصلاح کنید (احتمالاً ../lib/firebase صحیح است)
import { auth } from "../lib/firebase"; 

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // این تابع به محض تغییر وضعیت احراز هویت فراخوانی می‌شود
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // فقط یک بار loading را false می‌کند
    });

    return () => unsubscribe();
  }, []);

  // ✅ اگر هنوز در حال لودینگ است، یک صفحه ساده و سبک نشان می‌دهد
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-2 text-sm">در حال اتصال به صرافی...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
