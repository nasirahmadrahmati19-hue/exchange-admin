"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { title: "داشبورد", icon: "📊", href: "/dashboard", color: "from-blue-500 to-cyan-500" },
  { title: "کاربران", icon: "👥", href: "/dashboard/users", color: "from-violet-500 to-purple-500" },
  { title: "احراز هویت", icon: "🪪", href: "/dashboard/kyc", color: "from-amber-500 to-orange-500" },
  { title: "کیف پول‌ها", icon: "👛", href: "/dashboard/wallets", color: "from-emerald-500 to-teal-500" },
  { title: "برداشت‌ها", icon: "💸", href: "/dashboard/withdrawals", color: "from-rose-500 to-pink-500" },
  { title: "معاملات", icon: "📈", href: "/dashboard/trades", color: "from-indigo-500 to-blue-500" },
  { title: "بازارها", icon: "💱", href: "/dashboard/markets", color: "from-cyan-500 to-blue-500" },
  { title: "تیکت‌ها", icon: "🎫", href: "/dashboard/tickets", color: "from-fuchsia-500 to-pink-500" },
  { title: "تنظیمات", icon: "⚙️", href: "/dashboard/settings", color: "from-slate-500 to-gray-500" },
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

  const activeItem = menuItems.find((item) => item.href === pathname);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* هدر مدرن */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-lg shadow-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* لوگو */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">
                💱
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-lg bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  پنل مدیریت صرافی
                </h1>
              </div>
            </div>

            {/* منوی افقی مدرن */}
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-r " + item.color + " text-white shadow-lg scale-105"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="hidden lg:inline">{item.title}</span>
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full"></span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* پروفایل و خروج */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-xl">
                <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                  م
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-700">مدیر سیستم</p>
                  <p className="text-[10px] text-slate-500">آنلاین</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-all duration-300 text-sm font-medium group"
              >
                <span className="group-hover:-translate-x-1 transition-transform">🚪</span>
                <span className="hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* نوار زیر هدر - نمایش بخش فعال */}
      <div className="bg-white/50 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">📍 شما در بخش:</span>
            <span className={`text-sm font-bold bg-gradient-to-r ${activeItem?.color || "from-indigo-500 to-violet-500"} bg-clip-text text-transparent`}>
              {activeItem?.title || "داشبورد"}
            </span>
          </div>
        </div>
      </div>

      {/* محتوا */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>

      {/* فوتر */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
        <div className="text-center text-sm text-slate-400">
          <p>© ۱۴۰۴ پنل مدیریت صرافی | طراحی شده با ❤️</p>
        </div>
      </footer>
    </div>
  );
}
