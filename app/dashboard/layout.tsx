"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { title: "داشبورد", href: "/dashboard", icon: "home" },
  { title: "کاربران", href: "/dashboard/users", icon: "users" },
  { title: "احراز هویت", href: "/dashboard/kyc", icon: "shield" },
  { title: "کیف پول‌ها", href: "/dashboard/wallets", icon: "wallet" },
  { title: "برداشت‌ها", href: "/dashboard/withdrawals", icon: "send" },
  { title: "معاملات", href: "/dashboard/trades", icon: "chart" },
  { title: "بازارها", href: "/dashboard/markets", icon: "market" },
  { title: "تیکت‌ها", href: "/dashboard/tickets", icon: "ticket" },
  { title: "تنظیمات", href: "/dashboard/settings", icon: "settings" },
];

function MenuIcon({ name, className = "w-[18px] h-[18px]" }: { name: string; className?: string }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className };
  
  switch (name) {
    case "home":
      return (<svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></svg>);
    case "users":
      return (<svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
    case "shield":
      return (<svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>);
    case "wallet":
      return (<svg {...common}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" /></svg>);
    case "send":
      return (<svg {...common}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>);
    case "chart":
      return (<svg {...common}><path d="M3 3v18h18" /><path d="M7 15l4-6 3 4 5-7" /></svg>);
    case "market":
      return (<svg {...common}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /></svg>);
    case "ticket":
      return (<svg {...common}><path d="M2 9a3 3 0 0 1 0 6v4h20v-4a3 3 0 0 1 0-6V5H2v4z" /><path d="M13 5v2" /><path d="M13 11v2" /><path d="M13 17v2" /></svg>);
    case "settings":
      return (<svg {...common}><path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" /><path d="M1 14h6" /><path d="M9 8h6" /><path d="M17 16h6" /></svg>);
    default:
      return null;
  }
}

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
      <header className="sticky top-0 z-50 shadow-lg shadow-slate-900/10">
        <div className="bg-[#0b1f2e] text-white">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center text-[#0b1f2e] shadow-lg shadow-amber-900/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <path d="M12 2 2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <span className="text-[#e3b45c] text-[11px] font-bold block">پنل مدیریت</span>
                <h1 className="font-extrabold text-base leading-5">صرافی برادران نورزاد</h1>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button className="p-2.5 rounded-xl hover:bg-white/10 hover:text-[#e3b45c] transition-colors" title="اعلان‌ها">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="p-2.5 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="خروج"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#0f2839]">
          <nav className="max-w-7xl mx-auto px-2 flex items-end overflow-x-auto scrollbar-hide">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-bold whitespace-nowrap rounded-t-xl transition-colors ${
                    active
                      ? "bg-[#f6f4ee] text-[#0b1f2e]"
                      : "text-slate-300 hover:text-[#e3b45c] hover:bg-white/5"
                  }`}
                >
                  <MenuIcon name={item.icon} />
                  <span>{item.title}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#d9a441]" />}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 fade-up">{children}</main>

      <footer className="max-w-7xl mx-auto px-4 pb-8 text-center text-xs text-slate-400">
        © ۱۴۰۵ صرافی برادران نورزاد — تمام حقوق محفوظ است
      </footer>
    </div>
  );
}
