"use client";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { path: "/dashboard", label: "داشبورد", icon: "📊", gradient: "from-cyan-500 to-blue-500" },
  { path: "/dashboard/users", label: "کاربران", icon: "👥", gradient: "from-purple-500 to-pink-500" },
  { path: "/dashboard/kyc", label: "احراز هویت", icon: "🛡️", gradient: "from-green-500 to-emerald-500" },
  { path: "/dashboard/wallets", label: "کیف پول", icon: "💳", gradient: "from-yellow-500 to-orange-500" },
  { path: "/dashboard/withdrawals", label: "برداشت‌ها", icon: "💸", gradient: "from-red-500 to-rose-500" },
  { path: "/dashboard/trades", label: "معاملات", icon: "📈", gradient: "from-blue-500 to-indigo-500" },
  { path: "/dashboard/markets", label: "بازارها", icon: "📉", gradient: "from-teal-500 to-green-500" },
  { path: "/dashboard/tickets", label: "تیکت‌ها", icon: "🎫", gradient: "from-pink-500 to-rose-500" },
  { path: "/dashboard/settings", label: "تنظیمات", icon: "⚙️", gradient: "from-gray-600 to-gray-800" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* لوگو / نام برنامه */}
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                پنل مدیریت
              </span>
            </div>

            {/* منوی افقی – دسکتاپ */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
              {menuItems.map((item) => {
                const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
                return (
                  <Link key={item.path} href={item.path}>
                    <button
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap
                        ${isActive
                          ? `bg-gradient-to-r ${item.gradient} text-white shadow-md`
                          : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  </Link>
                );
              })}
            </nav>

            {/* بخش کاربر و خروج */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {user?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user}</span>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                خروج
              </button>
            </div>
          </div>

          {/* منوی موبایل */}
          <div className="lg:hidden overflow-x-auto pb-2 flex gap-1 mt-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all
                      ${isActive
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow`
                        : "text-gray-600 hover:bg-gray-100"
                      }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
