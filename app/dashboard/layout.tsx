"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { title: "داشبورد", icon: "📊", href: "/dashboard" },
  { title: "کاربران", icon: "👥", href: "/dashboard/users" },
  { title: "احراز هویت", icon: "🪪", href: "/dashboard/kyc" },
  { title: "کیف پول‌ها", icon: "👛", href: "/dashboard/wallets" },
  { title: "برداشت‌ها", icon: "💸", href: "/dashboard/withdrawals" },
  { title: "معاملات", icon: "📈", href: "/dashboard/trades" },
  { title: "بازارها", icon: "💱", href: "/dashboard/markets" },
  { title: "تیکت‌ها", icon: "🎫", href: "/dashboard/tickets" },
  { title: "تنظیمات", icon: "⚙️", href: "/dashboard/settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("isAuthenticated") !== "true") {
      router.push("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* هدر افقی */}
      <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* لوگو */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">💱</span>
              <span className="font-bold text-lg">پنل مدیریت صرافی</span>
            </div>

            {/* منوی افقی */}
            <nav className="flex items-center gap-1 overflow-x-auto">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    pathname === item.href
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="hidden md:inline">{item.title}</span>
                </Link>
              ))}
            </nav>

            {/* دکمه خروج و پروفایل */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  م
                </div>
                <span className="text-sm text-slate-300">مدیر سیستم</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-red-400 hover:bg-slate-800 transition-colors text-sm"
              >
                <span>🚪</span>
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* محتوا */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
