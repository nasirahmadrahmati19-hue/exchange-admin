// app/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
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

  // مقدار Context پایدار — جلوگیری از رندرهای زنجیره‌ای مصرف‌کننده‌ها
  const value = useMemo(() => ({ user, loading }), [user, loading]);

  // همیشه Provider را نگه می‌داریم تا children در حین لودینگ از Context پیش‌فرض جدا نشوند
  if (loading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm font-bold">در حال اتصال امن...</p>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto"></div>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
