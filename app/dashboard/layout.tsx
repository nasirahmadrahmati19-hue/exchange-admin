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
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-700">
          <h1 className="font-bold text-lg">💱 پنل مدیریت صرافی</h1>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                pathname === item.href
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{item.icon}</span>
              <span className="text-sm">{item.title}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-slate-800 transition-colors"
          >
            <span>🚪</span>
            <span className="text-sm">خروج</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 mr-64">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0">
          <h2 className="font-bold text-lg">سیستم مدیریت</h2>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              م
            </div>
            <span className="text-sm text-gray-600">مدیر سیستم</span>
          </div>
        </header>

        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
