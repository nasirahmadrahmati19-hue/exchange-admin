import type { Metadata, Viewport } from "next";
import { AuthProvider } from "./AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "صرافی من",
    template: "%s | صرافی من",
  },
  description: "اپلیکیشن صرافی",
  
  // ✅ خط manifest حذف شد، چون Next.js آن را به صورت خودکار از فایل app/manifest.ts می‌خواند
  
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192x192.png",
  },
  
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
    // ✅ خط suppressHydrationWarning حیاتی است و جلوی پرش ناشی از تفاوت سرور/کلاینت را می‌گیرد
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
