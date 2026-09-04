import type { Metadata } from "next";
import "./globals.css";
// توجه: مسیر حالا "./" است چون فایل کنار همین فایل قرار دارد
import { AuthProvider } from "./AuthProvider"; 

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
