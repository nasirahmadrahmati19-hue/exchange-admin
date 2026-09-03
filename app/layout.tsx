import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider"; // ← این خط اضافه شد

export const metadata: Metadata = {
  title: "صرافی برادران نورزاد",
  description: "سیستم مدیریت صرافی و حسابداری",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        {/* ← این دو خط اضافه شدند تا کل برنامه تحت پوشش سیستم لاگین قرار بگیرد */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
