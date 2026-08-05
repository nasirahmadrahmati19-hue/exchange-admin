"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { title: "داشبورد", href: "/dashboard" },
  { title: "حواله‌جات", href: "/dashboard/hawala" },
  { title: "تبادل ارز", href: "/dashboard/trades" },
  { title: "نرخ ارزها", href: "/dashboard/rates" },
  { title: "مشتریان", href: "/dashboard/users" },
  { title: "احراز هویت", href: "/dashboard/kyc" },
  { title: "تیکت‌ها", href: "/dashboard/tickets" },
  { title: "تنظیمات", href: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 shadow-lg">
        <div className="bg-[#0b1f2e] text-white">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center text-[#0b1f2e] font-extrabold">
                ن
              </div>
              <div>
                <span className="text-[#e3b45c] text-[11px] font-bold block">صرافی و حواله‌جات</span>
                <h1 className="font-extrabold text-base leading-5">برادران نورزاد — هرات</h1>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl hover:bg-red-500/20 text-red-300 text-sm font-bold"
            >
              خروج
            </button>
          </div>
        </div>

        <div className="bg-[#0f2839]">
          <nav className="max-w-7xl mx-auto px-2 flex items-end overflow-x-auto">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-5 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? "bg-[#f6f4ee] text-[#0b1f2e] border-[#d9a441]"
                      : "text-slate-300 hover:text-[#e3b45c] border-transparent"
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>

      <footer className="max-w-7xl mx-auto px-4 pb-8 text-center text-xs text-slate-400">
        © ۱۴۰۵ صرافی برادران نورزاد — هرات، افغانستان
      </footer>
    </div>
  );
}
