"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

// آیکون‌های SVG مدرن و خطی (سبک Lucide)
function Icon({ name, className = "w-[18px] h-[18px]" }: { name: string; className?: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "shield":
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...props}>
          <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
          <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
          <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
        </svg>
      );
    case "arrow-up":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16V8" />
          <path d="m9 11 3-3 3 3" />
        </svg>
      );
    case "trending":
      return (
        <svg {...props}>
          <path d="m22 7-8.5 8.5-5-5L2 17" />
          <path d="M16 7h6v6" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...props}>
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2" />
          <path d="M13 17v2" />
          <path d="M13 11v2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "logo":
      return (
        <svg {...props}>
          <path d="M12 2 2 7l10 5 10-5-10-5z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      );
    default:
      return null;
  }
}

const menuItems = [
  { title: "داشبورد", href: "/dashboard", icon: "dashboard" },
  { title: "کاربران", href: "/dashboard/users", icon: "users" },
  { title: "احراز هویت", href: "/dashboard/kyc", icon: "shield" },
  { title: "کیف پول‌ها", href: "/dashboard/wallets", icon: "wallet" },
  { title: "برداشت‌ها", href: "/dashboard/withdrawals", icon: "arrow-up" },
  { title: "معاملات", href: "/dashboard/trades", icon: "trending" },
  { title: "بازارها", href: "/dashboard/markets", icon: "activity" },
  { title: "تیکت‌ها", href: "/dashboard/tickets", icon: "ticket" },
  { title: "تنظیمات", href: "/dashboard/settings", icon: "settings" },
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
      <header className="sticky top-0 z-50 shadow-lg shadow-slate-900/10">
        {/* نوار بالایی سرمه‌ای */}
        <div className="bg-[#0b1f2e] text-white">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e8c06a] to-[#c98f2d] flex items-center justify-center text-[#0b1f2e] shadow-lg shadow-amber-900/30">
                <Icon name="logo" className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[#e3b45c] text-[11px] font-bold block tracking-wider">پنل مدیریت</span>
                <h1 className="font-extrabold text-base leading-5">صرافی برادران نورزاد</h1>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button className="relative p-2.5 rounded-xl hover:bg-white/10 hover:text-[#e3b45c] transition-colors" title="اعلان‌ها">
                <Icon name="bell" className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#d9a441] ring-2 ring-[#0b1f2e]" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="خروج"
              >
                <Icon name="logout" className="w-5 h-5" />
                <span className="text-sm font-bold hidden sm:inline">خروج</span>
              </button>
            </div>
          </div>
        </div>

        {/* نوار تب‌ها */}
        <div className="bg-[#0f2839]">
          <nav className="max-w-7xl mx-auto px-2 flex items-end overflow-x-auto scrollbar-hide">
            {menuItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2 px-5 py-3.5 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                    active
                      ? "bg-[#f6f4ee] text-[#0b1f2e] border-[#d9a441]"
                      : "text-slate-300 hover:text-[#e3b45c] hover:bg-white/5 border-transparent"
                  }`}
                >
                  <span className={`transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`}>
                    <Icon name={item.icon} />
                  </span>
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 fade-up">{children}</main>

      <footer className="max-w-7xl mx-auto px-4 pb-8 text-center text-xs text-slate-400">
        © ۱۴۰۵ صرافی برادران نورزاد — طراحی حرفه‌ای
      </footer>
    </div>
  );
}
