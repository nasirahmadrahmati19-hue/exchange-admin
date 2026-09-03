import type { Metadata } from "next";
import "./globals.css"; // اگر فایل استایل شما نام دیگری دارد، آن را اصلاح کنید

// ۱. تنظیمات متادیتا و آیکون
export const metadata: Metadata = {
  title: "صرافی برادران نورزاد",
  description: "سیستم مدیریت صرافی و حسابداری",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

// ۲. ساختار استاندارد Layout (این بخش بسیار مهم است)
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
