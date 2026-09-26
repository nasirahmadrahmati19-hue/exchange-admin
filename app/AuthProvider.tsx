"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";

// ✅ مسیر صحیح: پوشه lib داخل پوشه dashboard قرار دارد
import { auth } from "./dashboard/lib/firebase"; 

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ این صفحه لودینگ را نمایش می‌دهد
  if (loading) {
    return (
      // ✅ نکته کلیدی برای رفع پرش: کلاس bg-white (یا رنگ اصلی برنامه شما) 
      // باعث می‌شود تغییر از لودینگ به برنامه اصلی نرم و نامحسوس باشد.
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
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
