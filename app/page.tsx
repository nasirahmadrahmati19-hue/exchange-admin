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
  // ✅ manifest حذف شد تا خطای آیکون‌های گم‌شده قطع شود
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "صرافی من",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    title: "صرافی من",
    description: "اپلیکیشن صرافی",
    siteName: "صرافی من",
  },
  // ✅ بخش icons کاملاً حذف شد
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
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
