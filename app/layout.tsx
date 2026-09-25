// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "./AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "صرافی من",
    template: "%s | صرافی من",
  },
  description: "اپلیکیشن صرافی",
  // ❌ خط manifest حذف شد (چون فایل وجود ندارد)
  
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    title: "صرافی من",
    description: "اپلیکیشن صرافی",
    siteName: "صرافی من",
  },
  icons: {
    // ✅ تغییر به آیکونی که واقعاً در ریشه پروژه وجود دارد
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // ✅ تنظیمات موبایل به شکل استاندارد Next.js (جایگزین تگ head دستی)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "صرافی من",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1976d2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      {/* ✅ تگ head دستی حذف شد تا از تداخل با metadata جلوگیری شود */}
      <body className="antialiased">
        {/* ✅ ساختار امنیتی شما کاملاً دست‌نخورده باقی مانده است */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
